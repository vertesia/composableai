/**
 * Uploads in parts, for stream sources longer than one part (Node.js only).
 *
 * A single signed PUT is capped by the store (5 GB on S3, about 5,000 MiB on Azure) and cannot resume. A source
 * longer than {@link UPLOAD_PART_SIZE} therefore goes through an upload session, sent with the store's own protocol:
 *
 * - Google Cloud Storage: a resumable upload, written by `@google-cloud/storage`, which retries a failed chunk from
 *   the offset the service persisted.
 * - Azure Blob Storage: Put Block for each part then Put Block List, written by `@azure/storage-blob`.
 * - Amazon S3: a multipart upload. Each part is a `PUT` to a URL the server signs, retried like any signed-URL
 *   transfer, and the server completes the upload, or aborts it when a part cannot be sent.
 *
 * Memory stays about one part per upload, whatever the source's length, and nothing is written to disk.
 *
 * The two SDKs are optional peer dependencies, loaded only on this path. Without the one a session needs, the
 * upload falls back to a single signed PUT.
 */
import type {
    CompletedUploadPart,
    GcsResumableUploadSession,
    S3MultipartUploadSession,
    UploadSession,
} from '@vertesia/common';
import { StreamSource } from '../StreamSource.js';
import { ContentLengthMismatchError, exactLength, hasNodeHttp } from './node-request.js';
import { fetchSignedUrl, MAX_BUFFERED_STREAM_BYTES } from './signed-url.js';
import { chunkToBlobPart, continueStream } from './stream-bytes.js';
import { getUploadBody, type UploadBody } from './upload-body.js';

/** Sources longer than this are sent in parts: the most of a stream that is held in memory at once. */
export const UPLOAD_PART_SIZE = MAX_BUFFERED_STREAM_BYTES;

/** S3 numbers parts from 1 to 10,000; part URLs are signed this many at a time. */
const MAX_PARTS = 10_000;
const PART_URL_BATCH = 100;

/** Content to send in parts, with its declared length when it is a stream whose length is known. */
export interface PartsBody {
    body: Blob | ReadableStream<Uint8Array>;
    size?: number;
}

export type UploadPlan = { kind: 'single'; upload: UploadBody } | { kind: 'parts'; parts: PartsBody };

/** The operations an S3 multipart upload needs from the API. */
export interface MultipartUploadApi {
    getUploadPartUrls(payload: {
        id: string;
        upload_id: string;
        part_numbers: number[];
    }): Promise<{ parts: { part_number: number; url: string }[] }>;
    completeUploadSession(payload: {
        id: string;
        upload_id: string;
        parts: CompletedUploadPart[];
    }): Promise<{ etag?: string }>;
    abortUploadSession(payload: { id: string; upload_id: string }): Promise<unknown>;
}

/** The SDK an upload session needs is not installed. */
export class UploadSessionUnavailableError extends Error {
    constructor(
        readonly packageName: string,
        cause: unknown,
    ) {
        super(`Uploading in parts needs the optional package ${packageName}`, { cause });
        this.name = 'UploadSessionUnavailableError';
    }
}

/**
 * How to upload a source. A `File`, and anything in a browser, is sent in one PUT as before. In Node.js, a stream
 * source longer than one part is sent in parts. A plain stream is read up to one part to find out: one that ends
 * first is sent whole, from memory, so it keeps its retries.
 */
export async function planUpload(source: StreamSource | File): Promise<UploadPlan> {
    const upload = await getUploadBody(source);
    if (!(source instanceof StreamSource) || !hasNodeHttp()) return { kind: 'single', upload };
    const { body, contentLength } = upload;
    if (body instanceof Blob) {
        return body.size > UPLOAD_PART_SIZE ? { kind: 'parts', parts: { body } } : { kind: 'single', upload };
    }
    if (contentLength !== undefined && contentLength <= UPLOAD_PART_SIZE) return { kind: 'single', upload };

    const reader = (body as ReadableStream<unknown>).getReader();
    const head: BlobPart[] = [];
    let read = 0;
    try {
        while (read <= UPLOAD_PART_SIZE) {
            const { done, value } = await reader.read();
            if (done) {
                reader.releaseLock();
                return { kind: 'single', upload: { body: new Blob(head), contentLength } };
            }
            const part = chunkToBlobPart(value);
            head.push(part);
            read += part instanceof Blob ? part.size : (part as Uint8Array).byteLength;
        }
    } catch (err) {
        await reader.cancel(err).catch(() => undefined);
        throw err;
    }
    return { kind: 'parts', parts: { body: continueStream(head, reader), size: contentLength } };
}

/** The same content as one stream, for a single PUT when no session can be used. */
export function partsAsUploadBody(parts: PartsBody): UploadBody {
    return parts.body instanceof Blob ? { body: parts.body } : { body: parts.body, contentLength: parts.size };
}

/** Sends the content through the session. Returns the stored object's ETag, unquoted, when the store gives one. */
export async function uploadInParts(
    api: MultipartUploadApi,
    session: UploadSession,
    parts: PartsBody,
): Promise<string | undefined> {
    switch (session.protocol) {
        case 's3_multipart':
            return uploadS3Parts(api, session, parts);
        case 'gcs_resumable':
            return uploadGcsResumable(session, parts);
        case 'azure_block_blob':
            return uploadAzureBlocks(session.url, session.part_size, session.mime_type, parts);
    }
}

async function importOptional<T>(name: string, load: () => Promise<T>): Promise<T> {
    try {
        return await load();
    } catch (err: unknown) {
        const code = (err as { code?: unknown } | undefined)?.code;
        if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
            throw new UploadSessionUnavailableError(name, err);
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

async function uploadGcsResumable(session: GcsResumableUploadSession, parts: PartsBody): Promise<string | undefined> {
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
    // The same ETag a single PUT to the XML API answers with: the object's MD5, in hex.
    const md5 = file.metadata?.md5Hash;
    return typeof md5 === 'string' ? Buffer.from(md5, 'base64').toString('hex') : undefined;
}

async function uploadAzureBlocks(
    url: string,
    partSize: number,
    contentType: string | undefined,
    parts: PartsBody,
): Promise<string | undefined> {
    const { BlockBlobClient } = await importOptional('@azure/storage-blob', () => import('@azure/storage-blob'));
    const response = await new BlockBlobClient(url).uploadStream(await nodeReadable(parts), partSize, 1, {
        blobHTTPHeaders: { blobContentType: contentType },
    });
    return unquote(response.etag);
}

/** Splits the content into parts of `partSize` bytes; the last may be shorter. */
async function* blobParts(body: Blob | ReadableStream<Uint8Array>, partSize: number): AsyncGenerator<Blob> {
    if (body instanceof Blob) {
        for (let offset = 0; offset < body.size; offset += partSize) {
            yield body.slice(offset, Math.min(offset + partSize, body.size));
        }
        return;
    }
    const reader = body.getReader();
    let pending: Uint8Array[] = [];
    let pendingBytes = 0;
    let finished = false;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            let chunk = value;
            while (pendingBytes + chunk.byteLength >= partSize) {
                const take = partSize - pendingBytes;
                pending.push(chunk.subarray(0, take));
                yield new Blob(pending as BlobPart[]);
                pending = [];
                pendingBytes = 0;
                chunk = chunk.subarray(take);
            }
            if (chunk.byteLength > 0) {
                pending.push(chunk);
                pendingBytes += chunk.byteLength;
            }
        }
        finished = true;
        if (pendingBytes > 0) yield new Blob(pending as BlobPart[]);
    } finally {
        if (!finished) await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}

async function uploadS3Parts(
    api: MultipartUploadApi,
    session: S3MultipartUploadSession,
    parts: PartsBody,
): Promise<string | undefined> {
    const { id, upload_id } = session;
    const uploaded: CompletedUploadPart[] = [];
    let urls = new Map<number, string>();
    let sent = 0;
    try {
        for await (const part of blobParts(parts.body, session.part_size)) {
            const partNumber = uploaded.length + 1;
            if (partNumber > MAX_PARTS) {
                throw new Error(`Upload has more than ${MAX_PARTS} parts of ${session.part_size} bytes`);
            }
            sent += part.size;
            if (parts.size !== undefined && sent > parts.size) {
                throw new ContentLengthMismatchError(parts.size, sent, 'long');
            }
            let url = urls.get(partNumber);
            if (!url) {
                const last = Math.min(partNumber + PART_URL_BATCH - 1, MAX_PARTS);
                const part_numbers = Array.from({ length: last - partNumber + 1 }, (_, i) => partNumber + i);
                const signed = await api.getUploadPartUrls({ id, upload_id, part_numbers });
                urls = new Map(signed.parts.map((p) => [p.part_number, p.url]));
                url = urls.get(partNumber);
                if (!url) throw new Error(`No upload URL was signed for part ${partNumber}`);
            }
            const res = await fetchSignedUrl(url, { method: 'PUT', body: part });
            const detail = res.ok ? '' : await res.text().catch(() => '');
            if (res.ok) await res.body?.cancel().catch(() => undefined);
            const etag = res.headers.get('etag');
            if (!res.ok || !etag) {
                throw new Error(
                    `Failed to upload part ${partNumber}: ${res.status} ${res.statusText}${detail ? ` ${detail}` : ''}`,
                );
            }
            uploaded.push({ part_number: partNumber, etag });
        }
        if (parts.size !== undefined && sent < parts.size) {
            throw new ContentLengthMismatchError(parts.size, sent, 'short');
        }
        const completed = await api.completeUploadSession({ id, upload_id, parts: uploaded });
        return unquote(completed.etag);
    } catch (err) {
        await api.abortUploadSession({ id, upload_id }).catch(() => undefined);
        throw err;
    }
}

function unquote(etag: string | undefined): string | undefined {
    return etag?.replace(/^"(.*)"$/, '$1');
}
