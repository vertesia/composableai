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
 * been consumed, so it is buffered into memory before the first attempt to make
 * retries safe. Callers transferring very large streams should be aware of this
 * memory cost.
 */

/** HTTP statuses that storage backends return for transient, retryable conditions. */
const DEFAULT_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

const DEFAULT_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8_000;

export interface SignedUrlFetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    /** Total number of attempts, including the first. Defaults to 4. */
    attempts?: number;
    /** Base delay for exponential backoff, in milliseconds. Defaults to 500. */
    baseDelayMs?: number;
    /** Upper bound for a single backoff delay, in milliseconds. Defaults to 8000. */
    maxDelayMs?: number;
    /** HTTP statuses to retry on. Defaults to 429, 500, 502, 503, 504. */
    retryableStatuses?: ReadonlySet<number>;
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
        return Math.min(maxDelayMs, retryAfter);
    }
    // Exponential backoff with full jitter.
    const capped = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    return Math.floor(Math.random() * capped);
}

/**
 * Buffer a `ReadableStream` body into a `Blob` so the request can be safely
 * replayed across retries. Other body types (`Blob`/`File`, `ArrayBuffer`,
 * typed arrays, strings, `URLSearchParams`) are already replayable and pass
 * through unchanged.
 */
async function toReplayableBody(body: BodyInit | null | undefined): Promise<BodyInit | undefined> {
    if (body == null) {
        return undefined;
    }
    if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
        return await new Response(body).blob();
    }
    return body;
}

/**
 * `fetch()` a cloud-storage signed URL, retrying transient failures (connection
 * errors and retryable HTTP statuses) with exponential backoff. Honors a
 * `Retry-After` response header when present.
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

    const body = await toReplayableBody(options.body);

    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const isLastAttempt = attempt === attempts - 1;
        try {
            const res = await fetch(url, { method, headers, body });
            if (res.ok || !retryableStatuses.has(res.status) || isLastAttempt) {
                return res;
            }
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
