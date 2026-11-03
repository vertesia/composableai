import crypto from 'node:crypto';
import { open, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { VertesiaClient } from '@vertesia/client';
import tmp from 'tmp';
import { DocumentNotFoundError } from '../errors.js';

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

export async function fetchBlobAsBase64(client: VertesiaClient, blobUri: string): Promise<string> {
    const buffer = await fetchBlobAsBuffer(client, blobUri);
    return buffer.toString('base64');
}

/**
 * Download a blob to a new temporary file and return its path.
 *
 * The caller owns the file and must remove it (e.g. `fs.promises.rm(path, { force: true })` in a `finally`).
 * No descriptor is left open and nothing is registered for exit-time cleanup, so removing the path frees its space.
 */
export async function saveBlobToTempFile(client: VertesiaClient, blobUri: string, fileExt?: string): Promise<string> {
    const fileName = tmp.tmpNameSync({
        prefix: 'vertesia-activity-',
        postfix: fileExt ? `.${fileExt.replace(/^\./, '')}` : '',
    });
    // Create the file before downloading: a name that is already taken fails before any request, and only a file
    // this call created is ever removed.
    const file = await open(fileName, 'wx', 0o600);
    try {
        const stream = await fetchBlobAsStream(client, blobUri);
        // The write stream closes the descriptor once the pipeline settles.
        await pipeline(Readable.from(stream), file.createWriteStream());
        return fileName;
    } catch (err: unknown) {
        // A failed download never handed the descriptor to a write stream; closing an already closed one is a no-op.
        await file.close();
        // Best effort, and silent: this utility may run outside an activity, and the download failure is the
        // actionable error for the caller.
        await rm(fileName, { force: true }).catch(() => undefined);
        throw err;
    }
}

export function md5(contents: string) {
    return crypto.createHash('md5').update(contents).digest('hex');
}
