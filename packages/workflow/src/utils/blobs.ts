import crypto from 'node:crypto';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { log } from '@temporalio/activity';
import type { VertesiaClient } from '@vertesia/client';
import tmp from 'tmp';
import { DocumentNotFoundError, SourceTooLargeError } from '../errors.js';

// Process-wide: other tmp users rely on exit-time cleanup. saveBlobToTempFile registers nothing with tmp.
tmp.setGracefulCleanup();

export async function fetchBlobAsStream(client: VertesiaClient, blobUri: string): Promise<ReadableStream<Uint8Array>> {
    try {
        return await client.files.downloadFile(blobUri);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('not found')) {
            //TODO improve error handling with a fetch fail error class in the client
            throw new DocumentNotFoundError(`Not found at ${blobUri}: ${message}`, []);
        } else if (message.includes('forbidden')) {
            throw new DocumentNotFoundError(`Forbidden at ${blobUri}: ${message}`);
        } else {
            throw new Error(`Failed to download blob ${blobUri}: ${message}`);
        }
    }
}
export async function fetchBlobAsBuffer(client: VertesiaClient, blobUri: string): Promise<Buffer> {
    const stream = await fetchBlobAsStream(client, blobUri);
    const buffers: Uint8Array[] = [];
    for await (const data of stream) {
        buffers.push(data);
    }
    return Buffer.concat(buffers);
}

/** The start of a blob, read by {@link fetchBlobHead}. */
export interface BlobHead {
    data: Buffer;
    /** True when the blob holds more than `data`: the download stopped there. */
    truncated: boolean;
}

/**
 * Read at most `maxBytes` of a blob, then stop the download. Whatever the blob's size, the caller holds no more than
 * `maxBytes` of it in memory.
 */
export async function fetchBlobHead(client: VertesiaClient, blobUri: string, maxBytes: number): Promise<BlobHead> {
    const stream = await fetchBlobAsStream(client, blobUri);
    const chunks: Uint8Array[] = [];
    let size = 0;
    // Leaving the loop early cancels the stream, which aborts the download.
    for await (const chunk of stream) {
        if (size + chunk.byteLength > maxBytes) {
            chunks.push(chunk.subarray(0, maxBytes - size));
            return { data: Buffer.concat(chunks), truncated: true };
        }
        chunks.push(chunk);
        size += chunk.byteLength;
    }
    return { data: Buffer.concat(chunks), truncated: false };
}

/** Options of a download to disk. */
export interface BlobDownloadOptions {
    /**
     * The largest blob to download, in bytes. A larger one fails with a {@link SourceTooLargeError}: before the
     * download when the store reports the blob's size, otherwise as soon as the download goes over.
     */
    maxBytes?: number;
}

/**
 * The size of a blob, as its store reports it, or `undefined` when the store cannot tell (a signed URL, a store
 * error). Reading it downloads nothing.
 */
export async function getBlobSize(client: VertesiaClient, blobUri: string): Promise<number | undefined> {
    if (/^https?:/.test(blobUri)) {
        return undefined;
    }
    try {
        const { size } = await client.files.getMetadata(blobUri);
        return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined;
    } catch (err: unknown) {
        // The download that follows reports a missing blob properly, and enforces any size limit itself.
        warn('Could not read the size of a blob', { blob_uri: blobUri, error: errorMessage(err) });
        return undefined;
    }
}

/**
 * Fail with a {@link SourceTooLargeError} when the store reports a blob larger than `maxBytes`. A blob whose size is
 * unknown passes: a capped download ({@link BlobDownloadOptions.maxBytes}) still stops it.
 */
export async function assertBlobSizeWithin(client: VertesiaClient, blobUri: string, maxBytes: number): Promise<void> {
    const size = await getBlobSize(client, blobUri);
    if (size !== undefined && size > maxBytes) {
        throw new SourceTooLargeError(blobUri, maxBytes, size);
    }
}

export async function fetchBlobAsBase64(client: VertesiaClient, blobUri: string): Promise<string> {
    const buffer = await fetchBlobAsBuffer(client, blobUri);
    return buffer.toString('base64');
}

/**
 * Download a blob to a new temporary file and return its path.
 *
 * The caller owns the file and must remove it with {@link removeTempFiles} in a `finally`. Prefer
 * {@link withBlobTempFile}, which removes it for you, or {@link fetchBlobAsBuffer} when the file would only be read
 * into memory. No descriptor is left open and nothing is registered for exit-time cleanup, so removing the path frees
 * its space.
 */
export async function saveBlobToTempFile(
    client: VertesiaClient,
    blobUri: string,
    fileExt?: string,
    options: BlobDownloadOptions = {},
): Promise<string> {
    const fileName = tmp.tmpNameSync({
        prefix: 'vertesia-activity-',
        postfix: toPostfix(fileExt),
    });
    try {
        await saveBlobToNewFile(client, blobUri, fileName, options);
        return fileName;
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException | undefined)?.code !== 'EEXIST') {
            // Best effort, and silent: the download failure is the actionable error for the caller.
            await rm(fileName, { force: true }).catch(() => undefined);
        }
        throw err;
    }
}

/**
 * Download a blob into a new work directory, run `fn` with the file's path, and remove the directory whatever the
 * outcome. Files `fn` writes into `dir` are removed with it.
 *
 * @param fileExt extension of the downloaded file, with or without the leading dot (e.g. `pdf`)
 */
export async function withBlobTempFile<T>(
    client: VertesiaClient,
    blobUri: string,
    fileExt: string | undefined,
    fn: (file: string, dir: string) => Promise<T>,
    options: BlobDownloadOptions = {},
): Promise<T> {
    const dir = await mkdtemp(join(tmpdir(), 'vertesia-activity-'));
    try {
        const file = join(dir, `blob${toPostfix(fileExt)}`);
        await saveBlobToNewFile(client, blobUri, file, options);
        return await fn(file, dir);
    } finally {
        await removeTempFiles(dir);
    }
}

/**
 * Remove temporary files or directories, ignoring paths that are `undefined` or already gone. A failure is logged,
 * never thrown, so cleanup in a `finally` cannot replace the result or error of the code that created them.
 */
export async function removeTempFiles(...paths: Array<string | undefined>): Promise<void> {
    await Promise.all(
        paths.map(async (path) => {
            if (!path) {
                return;
            }
            try {
                await rm(path, { force: true, recursive: true });
            } catch (err: unknown) {
                warnCleanupFailure(path, err);
            }
        }),
    );
}

function warnCleanupFailure(path: string, err: unknown): void {
    // The activity logger does not serialize an Error, so the message goes as a plain field.
    warn('Failed to remove temporary file', { path, error: errorMessage(err) });
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function warn(message: string, attributes: Record<string, unknown>): void {
    try {
        log.warn(message, attributes);
    } catch {
        // No activity context: these utilities also run outside activities.
        console.warn(message, attributes);
    }
}

/**
 * Create `file`, failing if it already exists, and write the blob to it. The descriptor is closed whatever the outcome;
 * removing a partial file is the caller's job.
 */
async function saveBlobToNewFile(
    client: VertesiaClient,
    blobUri: string,
    file: string,
    { maxBytes }: BlobDownloadOptions,
): Promise<void> {
    if (maxBytes !== undefined) {
        await assertBlobSizeWithin(client, blobUri, maxBytes);
    }
    // Create the file before downloading: a name that is already taken fails before any request.
    const handle = await open(file, 'wx', 0o600);
    try {
        const stream = await fetchBlobAsStream(client, blobUri);
        // The write stream closes the descriptor once the pipeline settles. A failure destroys the source, which
        // aborts the download.
        if (maxBytes === undefined) {
            await pipeline(Readable.from(stream), handle.createWriteStream());
        } else {
            await pipeline(Readable.from(stream), limitBytes(blobUri, maxBytes), handle.createWriteStream());
        }
    } catch (err: unknown) {
        // A failed download never handed the descriptor to a write stream; closing an already closed one is a no-op.
        await handle.close();
        throw err;
    }
}

/** Pass bytes through until more than `maxBytes` went by, then fail with a {@link SourceTooLargeError}. */
function limitBytes(blobUri: string, maxBytes: number): Transform {
    let size = 0;
    return new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            size += chunk.length;
            callback(size > maxBytes ? new SourceTooLargeError(blobUri, maxBytes) : null, chunk);
        },
    });
}

function toPostfix(ext: string | undefined): string {
    return ext ? `.${ext.replace(/^\./, '')}` : '';
}

export function md5(contents: string) {
    return crypto.createHash('md5').update(contents).digest('hex');
}
