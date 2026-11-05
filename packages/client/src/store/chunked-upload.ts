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
 * Memory stays about one part per upload, and nothing is written to disk. Parts are 16 MiB, or larger for content
 * whose length would need more parts than the store allows: S3 takes 10,000 and Azure 50,000.
 *
 * The two SDKs are optional peer dependencies, loaded only on this path. Without the one a session needs, the
 * upload falls back to a single signed PUT.
 */
import type { CompletedUploadPart, S3MultipartUploadSession, UploadSession } from '@vertesia/common';
import { StreamSource } from '../StreamSource.js';
// hasNodeHttp from node-request, whose browser build answers false: a bundle without the Node transport never
// opens a session.
import { hasNodeHttp } from './node-request.js';
import { uploadAzureBlocks, uploadGcsResumable } from './node-sessions.js';
import { fetchSignedUrl, MAX_BUFFERED_STREAM_BYTES } from './signed-url.js';
import { chunkToBlobPart, continueStream } from './stream-bytes.js';
import { getUploadBody, type UploadBody, unquoteEtag } from './upload-body.js';
import { ContentLengthMismatchError, UploadSessionUnavailableError } from './upload-runtime.js';

export { UploadSessionUnavailableError } from './upload-runtime.js';

/** Sources longer than this are sent in parts: the most of a stream that is held in memory at once. */
export const UPLOAD_PART_SIZE = MAX_BUFFERED_STREAM_BYTES;

const MiB = 1024 * 1024;
/** S3 numbers parts from 1 to 10,000 and takes objects up to 5 TiB. */
const S3_MAX_PARTS = 10_000;
const S3_MAX_OBJECT_SIZE = 5 * 1024 * 1024 * MiB;
/** For a stream of unknown length, S3 parts double in size every this many parts: 16 MiB parts reach 968 GiB. */
const S3_PARTS_PER_SIZE = 2_000;
/** Azure commits at most 50,000 blocks. */
const AZURE_MAX_BLOCKS = 50_000;
/**
 * Part URLs are signed this many at a time, and signed again once this old, since they expire (S3 default, one hour,
 * or sooner with the signer's credentials) while a slow source fills the parts before them.
 */
const PART_URL_BATCH = 100;
const PART_URL_MAX_AGE_MS = 15 * 60_000;

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
            return unquoteEtag(
                await uploadAzureBlocks(
                    session.url,
                    fitParts(session.part_size, knownSize(parts), AZURE_MAX_BLOCKS),
                    session.mime_type,
                    parts,
                ),
            );
        default:
            // A protocol from a newer server: upload in one request instead, before reading anything.
            throw new UploadSessionUnavailableError(
                `support for the ${(session as { protocol: unknown }).protocol} protocol`,
            );
    }
}

function knownSize(parts: PartsBody): number | undefined {
    return parts.body instanceof Blob ? parts.body.size : parts.size;
}

/** `base`, or when `size` bytes would need more than `maxParts` parts of it, the whole number of MiB that fits. */
function fitParts(base: number, size: number | undefined, maxParts: number): number {
    const needed = size === undefined ? 0 : Math.ceil(size / maxParts);
    return needed <= base ? base : Math.ceil(needed / MiB) * MiB;
}

/**
 * The size of each S3 part. With the length known, one size that fits it in 10,000 parts. Without, parts grow as the
 * upload does, so a stream of unknown length can reach 968 GiB while short uploads keep small parts.
 */
function s3PartSizes(base: number, size: number | undefined): (partNumber: number) => number {
    if (size !== undefined) {
        if (size > S3_MAX_OBJECT_SIZE) {
            throw new Error(`S3 takes objects up to 5 TiB; this upload is declared at ${size} bytes`);
        }
        const fixed = fitParts(base, size, S3_MAX_PARTS);
        return () => fixed;
    }
    return (partNumber) => base * 2 ** Math.floor((partNumber - 1) / S3_PARTS_PER_SIZE);
}

/** Splits the content into parts, part `n` of `partSize(n)` bytes; the last may be shorter. */
async function* blobParts(
    body: Blob | ReadableStream<Uint8Array>,
    partSize: (partNumber: number) => number,
): AsyncGenerator<Blob> {
    let partNumber = 1;
    if (body instanceof Blob) {
        for (let offset = 0; offset < body.size; partNumber++) {
            const end = Math.min(offset + partSize(partNumber), body.size);
            yield body.slice(offset, end);
            offset = end;
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
            while (pendingBytes + chunk.byteLength >= partSize(partNumber)) {
                const take = partSize(partNumber) - pendingBytes;
                pending.push(chunk.subarray(0, take));
                yield new Blob(pending as BlobPart[]);
                partNumber++;
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
    let signedAt = 0;
    let sent = 0;

    async function partUrl(partNumber: number, renew: boolean): Promise<string> {
        if (renew || !urls.has(partNumber) || Date.now() - signedAt > PART_URL_MAX_AGE_MS) {
            const last = Math.min(partNumber + PART_URL_BATCH - 1, S3_MAX_PARTS);
            const part_numbers = Array.from({ length: last - partNumber + 1 }, (_, i) => partNumber + i);
            const signed = await api.getUploadPartUrls({ id, upload_id, part_numbers });
            urls = new Map(signed.parts.map((p) => [p.part_number, p.url]));
            signedAt = Date.now();
        }
        const url = urls.get(partNumber);
        if (!url) throw new Error(`No upload URL was signed for part ${partNumber}`);
        return url;
    }

    try {
        for await (const part of blobParts(parts.body, s3PartSizes(session.part_size, knownSize(parts)))) {
            const partNumber = uploaded.length + 1;
            if (partNumber > S3_MAX_PARTS) {
                throw new Error(`Upload needs more than ${S3_MAX_PARTS} parts`);
            }
            sent += part.size;
            if (parts.size !== undefined && sent > parts.size) {
                throw new ContentLengthMismatchError(parts.size, sent, 'long');
            }
            let res = await fetchSignedUrl(await partUrl(partNumber, false), { method: 'PUT', body: part });
            if (res.status === 403) {
                // An expired URL, or one whose signing credentials expired: sign it again, once.
                await res.body?.cancel().catch(() => undefined);
                res = await fetchSignedUrl(await partUrl(partNumber, true), { method: 'PUT', body: part });
            }
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
        return unquoteEtag(completed.etag);
    } catch (err) {
        await api.abortUploadSession({ id, upload_id }).catch(() => undefined);
        throw err;
    }
}
