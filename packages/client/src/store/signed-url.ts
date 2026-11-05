/**
 * Helpers for transferring file content to/from cloud-storage signed URLs
 * (GCS, S3, Azure Blob) with retry + backoff on transient failures.
 *
 * Signed-URL transfers go straight to the storage backend and therefore bypass
 * the Vertesia API client (`AbstractFetchClient`), which means they normally get
 * none of its retry policy. A single transient `503 Service Unavailable` from the
 * storage backend would otherwise fail the whole upload/download. This helper
 * restores retry behaviour for those storage hops.
 *
 * Note on streamed bodies: a `ReadableStream` body cannot be replayed once it has
 * been consumed. Up to {@link MAX_BUFFERED_STREAM_BYTES} of it is buffered so that
 * small bodies keep their retries. In Node.js, a longer stream is never held whole in
 * memory: where the storage service accepts a body of unknown length it is sent once,
 * as a stream, without retries (see {@link acceptsStreamedUpload}). Send a `Blob` backed
 * by a local file (Node's `fs.openAsBlob`) to keep retries for large files without a
 * copy in memory. A browser buffers a stream whole, as most browsers cannot send one.
 *
 * A stream whose length the caller declares in a `Content-Length` header is, in Node.js,
 * streamed with that length to any service, and fails if it ends short of it or runs
 * past it.
 *
 * In Node.js, a body over that size, or a streamed one, is sent with Node's `http`
 * client rather than `fetch`, which holds a streamed request body in memory until the
 * request completes (see {@link nodeRequest}).
 */
import { hasNodeHttp, nodeRequest } from './node-request.js';
import { ContentLengthMismatchError, contentLengthHeader } from './upload-runtime.js';

/** HTTP statuses that storage backends return for transient, retryable conditions. */
const DEFAULT_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

const DEFAULT_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8_000;
const MAX_RETRY_AFTER_MS = 60_000;

/** The most of a stream body that is buffered to allow retries: 16 MiB. */
export const MAX_BUFFERED_STREAM_BYTES = 16 * 1024 * 1024;

export interface SignedUrlFetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    /** Total number of attempts, including the first. Defaults to 4. */
    attempts?: number;
    /** Base delay for exponential backoff, in milliseconds. Defaults to 500. */
    baseDelayMs?: number;
    /** Upper bound for exponential backoff, in milliseconds. Defaults to 8000. Retry-After takes precedence. */
    maxDelayMs?: number;
    /** HTTP statuses to retry on. Defaults to 429, 500, 502, 503, 504. */
    retryableStatuses?: ReadonlySet<number>;
}

/** Blob Storage host suffixes of the public Azure cloud and Azure Government. */
const AZURE_BLOB_HOST_SUFFIXES = ['.blob.core.windows.net', '.blob.core.usgovcloudapi.net'];

/**
 * Whether a signed URL points at Azure Blob Storage: a SAS URL on `<account>.blob.core.windows.net`, or
 * `<account>.blob.core.usgovcloudapi.net` in Azure Government.
 */
export function isAzureBlobUrl(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return AZURE_BLOB_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    } catch {
        return false;
    }
}

/**
 * The headers for a `PUT` of file content to a signed upload URL.
 *
 * Azure's Put Blob rejects a request without `x-ms-blob-type`, so it is added for Azure Blob URLs
 * only. GCS and S3 requests are left untouched: from a browser every extra header must be allowed
 * by the bucket's CORS policy, and a header those backends do not expect would fail the preflight.
 */
export function signedUrlUploadHeaders(
    url: string,
    headers?: Record<string, string>,
): Record<string, string> | undefined {
    if (!isAzureBlobUrl(url)) return headers;
    if (headers && Object.keys(headers).some((name) => name.toLowerCase() === 'x-ms-blob-type')) return headers;
    return { ...headers, 'x-ms-blob-type': 'BlockBlob' };
}

/**
 * Whether a signed URL's storage service accepts an upload of unknown length, sent with chunked transfer encoding
 * and no `Content-Length`. Google Cloud Storage does; Amazon S3 (`MissingContentLength`) and Azure Blob Storage
 * (411 Length Required) need the length up front.
 */
export function acceptsStreamedUpload(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname === 'storage.googleapis.com' || hostname.endsWith('.storage.googleapis.com');
    } catch {
        return false;
    }
}

function isStream(body: BodyInit | null | undefined): boolean {
    return typeof ReadableStream !== 'undefined' && body instanceof ReadableStream;
}

function withoutContentLength(headers: Record<string, string> | undefined): Record<string, string> | undefined {
    if (!headers) return headers;
    return Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'content-length'));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(res: Response): number | undefined {
    const header = res.headers.get('retry-after');
    if (!header) {
        return undefined;
    }
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds * 1000;
    }
    const date = Date.parse(header);
    if (!Number.isNaN(date)) {
        return Math.max(0, date - Date.now());
    }
    return undefined;
}

function backoffMs(attempt: number, baseDelayMs: number, maxDelayMs: number, res?: Response): number {
    const retryAfter = res ? retryAfterMs(res) : undefined;
    if (retryAfter !== undefined) {
        return retryAfter;
    }
    // Exponential backoff with full jitter.
    const capped = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    return Math.floor(Math.random() * capped);
}

const textEncoder = new TextEncoder();

/**
 * Normalize one `ReadableStream` chunk to a byte-backed `BlobPart`.
 *
 * A web stream produced from a Node `Readable.from(<string>)` (e.g. via
 * `Readable.toWeb`, which `NodeStreamSource` uses) yields *string* chunks. Buffering
 * such a stream with `new Response(stream).blob()` throws under undici with
 * "TypeError: Received non-Uint8Array chunk", which breaks every signed-URL upload of
 * a text/JSON body (extracted text previews, agent artifacts, tool storage). Encoding
 * chunks ourselves keeps both string and binary bodies uploadable.
 */
function chunkToBlobPart(chunk: unknown): BlobPart {
    if (typeof chunk === 'string') {
        return textEncoder.encode(chunk);
    }
    if (chunk instanceof Blob) {
        return chunk;
    }
    if (chunk instanceof ArrayBuffer) {
        return new Uint8Array(chunk);
    }
    // Covers Uint8Array and every other typed-array / DataView view.
    if (ArrayBuffer.isView(chunk)) {
        return new Uint8Array(chunk.buffer as ArrayBuffer, chunk.byteOffset, chunk.byteLength);
    }
    // Fail loud rather than uploading e.g. "[object Object]" from an accidental
    // object-mode stream — silently corrupting the stored content is worse than a clear error.
    throw new TypeError(
        `Unsupported signed-URL upload chunk of type "${typeof chunk}"; ` +
            `body streams must yield string or binary (Uint8Array/ArrayBuffer/DataView/Blob) chunks.`,
    );
}

/** A request body, and whether it can be sent again for a retry. */
interface PreparedBody {
    body: BodyInit | undefined;
    replayable: boolean;
}

/**
 * Make a body safe to send. Bodies other than a `ReadableStream` (`Blob`/`File`, `ArrayBuffer`, typed arrays,
 * strings, `URLSearchParams`) are already replayable and pass through unchanged.
 *
 * A stream is read until it ends or passes `maxBufferedBytes`. A stream that ends first is returned as a `Blob`, so
 * it can be retried. A longer one is returned as a stream that yields the bytes read so far and then the rest,
 * unless `bufferWhole` is set, in which case the rest is buffered too.
 *
 * Chunks are normalized one by one (rather than `new Response(stream).blob()`) so that string chunks are encoded to
 * bytes — see {@link chunkToBlobPart}.
 */
async function prepareBody(
    body: BodyInit | null | undefined,
    maxBufferedBytes: number,
    bufferWhole: boolean,
): Promise<PreparedBody> {
    if (body == null) {
        return { body: undefined, replayable: true };
    }
    if (typeof ReadableStream === 'undefined' || !(body instanceof ReadableStream)) {
        return { body, replayable: true };
    }
    const reader = (body as ReadableStream<unknown>).getReader();
    const parts: BlobPart[] = [];
    let buffered = 0;
    try {
        for (;;) {
            if (!bufferWhole && buffered > maxBufferedBytes) {
                return { body: continueStream(parts, reader), replayable: false };
            }
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            // Normalize every chunk (a stray null/undefined is rejected by
            // chunkToBlobPart) so a malformed stream fails loudly instead of
            // silently uploading a truncated body.
            const part = chunkToBlobPart(value);
            parts.push(part);
            buffered += part instanceof Blob ? part.size : (part as Uint8Array).byteLength;
        }
    } catch (err) {
        // Signal the producer to stop and release its resources before propagating.
        await reader.cancel(err).catch(() => undefined);
        reader.releaseLock();
        throw err;
    }
    reader.releaseLock();
    return { body: new Blob(parts), replayable: true };
}

/** A byte stream of `head`, the parts already read, then what is left in `reader`. */
function continueStream(head: BlobPart[], reader: ReadableStreamDefaultReader<unknown>): ReadableStream<Uint8Array> {
    const pending = [...head];
    return new ReadableStream<Uint8Array>(
        {
            async pull(controller) {
                const next = pending.shift();
                if (next !== undefined) {
                    controller.enqueue(await partToBytes(next));
                    return;
                }
                const { done, value } = await reader.read();
                if (done) {
                    controller.close();
                } else {
                    controller.enqueue(await partToBytes(chunkToBlobPart(value)));
                }
            },
            async cancel(reason) {
                pending.length = 0;
                await reader.cancel(reason);
            },
        },
        { highWaterMark: 0 },
    );
}

async function partToBytes(part: BlobPart): Promise<Uint8Array> {
    return part instanceof Blob ? new Uint8Array(await part.arrayBuffer()) : (part as Uint8Array);
}

/**
 * `fetch()` a cloud-storage signed URL, retrying transient failures (connection
 * errors and retryable HTTP statuses) with exponential backoff. Honors a
 * `Retry-After` response header up to 60 seconds. Longer delays return the response
 * without retrying so the caller can schedule recovery outside this request.
 *
 * A `PUT` to an Azure Blob SAS URL gets the `x-ms-blob-type` header it requires (see
 * {@link signedUrlUploadHeaders}).
 *
 * The returned `Response` is only guaranteed to be retried while it carries a
 * retryable status; a non-retryable error response (e.g. 403, 404) is returned
 * as-is for the caller to handle.
 */
export async function fetchSignedUrl(url: string, options: SignedUrlFetchOptions = {}): Promise<Response> {
    const {
        method = 'GET',
        headers,
        attempts = DEFAULT_ATTEMPTS,
        baseDelayMs = DEFAULT_BASE_DELAY_MS,
        maxDelayMs = DEFAULT_MAX_DELAY_MS,
        retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    } = options;

    // In Node.js, a stream longer than the buffer is sent once as a stream where that works: to a service that
    // accepts a body of unknown length, or with the length the caller declared. Elsewhere it is still buffered
    // whole: S3 and Azure reject a body without a length, and browsers can neither set one nor, in most of them,
    // send a stream at all.
    const declaredLength = isStream(options.body) ? contentLengthHeader(headers) : undefined;
    const streamable = hasNodeHttp() && (acceptsStreamedUpload(url) || declaredLength !== undefined);
    const { body, replayable } = await prepareBody(options.body, MAX_BUFFERED_STREAM_BYTES, !streamable);
    let sendHeaders = headers;
    if (declaredLength !== undefined && body instanceof Blob) {
        if (body.size !== declaredLength) {
            throw new ContentLengthMismatchError(
                declaredLength,
                body.size,
                body.size < declaredLength ? 'short' : 'long',
            );
        }
        // the buffered body sets its own length
        sendHeaders = withoutContentLength(headers);
    }
    const requestHeaders = method.toUpperCase() === 'PUT' ? signedUrlUploadHeaders(url, sendHeaders) : sendHeaders;
    const maxAttempts = replayable ? attempts : 1;
    // Only Node.js streams a body (`streamable`), and always with Node's http client, so fetch only gets buffered ones.
    const large = !replayable || (body instanceof Blob && body.size > MAX_BUFFERED_STREAM_BYTES);
    const send =
        large && hasNodeHttp()
            ? () => nodeRequest(url, { method, headers: requestHeaders, body: body as Blob | ReadableStream })
            : () => fetch(url, { method, headers: requestHeaders, body });

    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const isLastAttempt = attempt === maxAttempts - 1;
        try {
            const res = await send();
            if (res.ok || !retryableStatuses.has(res.status) || isLastAttempt) {
                return res;
            }
            // Do not retry earlier than requested or park the caller beyond the retry budget.
            // Returning the response also avoids overflowing JavaScript's timer range.
            if ((retryAfterMs(res) ?? 0) > MAX_RETRY_AFTER_MS) return res;
            // Retryable status: drain the body so the connection can be reused, then back off.
            await res.body?.cancel().catch(() => undefined);
            await sleep(backoffMs(attempt, baseDelayMs, maxDelayMs, res));
        } catch (err) {
            lastError = err;
            if (isLastAttempt) {
                throw err;
            }
            await sleep(backoffMs(attempt, baseDelayMs, maxDelayMs));
        }
    }

    // Unreachable: the loop always returns a Response or throws on the last attempt.
    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch signed URL: ${url}`);
}
