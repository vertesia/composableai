/**
 * The upload-session writers that run on the storage services' own SDKs: Google Cloud Storage resumable uploads and
 * Azure block blobs (see `chunked-upload.ts`). The SDKs are optional peer dependencies, loaded on first use.
 *
 * Node.js only. Browser bundles get `node-sessions.browser.ts` instead, through the `browser` field of
 * `package.json`, so they never resolve the SDKs or Node's `stream` module.
 */
import type { GcsResumableUploadSession } from '@vertesia/common';
import type { PartsBody } from './chunked-upload.js';
import { exactLength } from './node-request.js';
import { UploadSessionUnavailableError } from './upload-runtime.js';

async function importOptional<T>(name: string, load: () => Promise<T>): Promise<T> {
    try {
        return await load();
    } catch (err: unknown) {
        const code = (err as { code?: unknown } | undefined)?.code;
        if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
            throw new UploadSessionUnavailableError(`the optional package ${name}`, err);
        }
        throw err;
    }
}

/** The content as a Node stream that fails, before it ends, when it does not match its declared length. */
async function nodeReadable(parts: PartsBody): Promise<import('node:stream').Readable> {
    const { Readable, Transform } = await import('node:stream');
    const { pipeline } = await import('node:stream/promises');
    const web = parts.body instanceof Blob ? parts.body.stream() : parts.body;
    const source = Readable.fromWeb(web as Parameters<typeof Readable.fromWeb>[0]);
    if (parts.size === undefined) return source;
    const counted = exactLength(parts.size, Transform);
    // The pipeline forwards an error of the source to `counted`, which is what the SDK reads.
    pipeline(source, counted).catch(() => undefined);
    return counted;
}

/** Writes the content to a GCS resumable session. Returns the object's MD5 in hex, the ETag a single PUT gives. */
export async function uploadGcsResumable(
    session: GcsResumableUploadSession,
    parts: PartsBody,
): Promise<string | undefined> {
    const [{ Storage }, { PassThroughClient }] = await Promise.all([
        importOptional('@google-cloud/storage', () => import('@google-cloud/storage')),
        importOptional('google-auth-library', () => import('google-auth-library')),
    ]);
    const { pipeline } = await import('node:stream/promises');
    const slash = session.path.indexOf('/');
    // The session URI is the only credential the upload needs, so requests carry no other.
    const file = new Storage({ authClient: new PassThroughClient() })
        .bucket(session.path.slice(0, slash))
        .file(session.path.slice(slash + 1));
    const writable = file.createWriteStream({
        uri: session.url,
        resumable: true,
        chunkSize: session.part_size,
        metadata: { contentType: session.mime_type },
    });
    await pipeline(await nodeReadable(parts), writable);
    const md5 = file.metadata?.md5Hash;
    return typeof md5 === 'string' ? Buffer.from(md5, 'base64').toString('hex') : undefined;
}

/** Uploads the content as blocks of `blockSize` bytes, one at a time, then commits them. Returns the blob's ETag. */
export async function uploadAzureBlocks(
    url: string,
    blockSize: number,
    contentType: string | undefined,
    parts: PartsBody,
): Promise<string | undefined> {
    const { BlockBlobClient } = await importOptional('@azure/storage-blob', () => import('@azure/storage-blob'));
    const readable = await nodeReadable(parts);
    try {
        const response = await new BlockBlobClient(url).uploadStream(readable, blockSize, 1, {
            blobHTTPHeaders: { blobContentType: contentType },
        });
        return response.etag;
    } catch (err: unknown) {
        // The SDK stops reading but leaves the stream open; destroying it cancels the source.
        readable.destroy();
        throw err;
    }
}
