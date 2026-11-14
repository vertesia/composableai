import {
    ConnectionError,
    type RateLimitMetadata,
    type RequestError,
    ResponseReadError,
    ServerError,
} from './errors.js';
import { type ServerSentEvent, sse } from './sse/index.js';
import { buildQueryString, join, removeTrailingSlash } from './utils.js';

export type FETCH_FN = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
type IPrimitives = string | number | boolean | null | undefined | string[] | number[] | boolean[];

export interface IRequestRetryPolicy {
    /** Stable create-operation key provider for durable callers; requires idempotencyKeys. */
    idempotencyKey?: (operationPayload?: unknown) => string;
    /** Stable ObjectId provider for durable data imports; requires idempotencyKeys. */
    importId?: (operationPayload?: unknown) => string;
    /**
     * Total attempts, including the first request. Defaults to 3 when a retry policy is enabled.
     */
    attempts?: number;
    /**
     * HTTP methods that may be retried. Defaults to idempotent methods.
     */
    methods?: string[];
    /**
     * HTTP response statuses that should be retried. Defaults to 502, 503, and 504.
     */
    statuses?: number[];
    /**
     * Also retry any 5xx whose body is not JSON — e.g. an HTML error page from a load balancer,
     * gateway, or Cloud Run ("no available instance" / "try again in 30 seconds"). These originate
     * at the edge, not the application (which serializes its errors as JSON), so they are transient
     * and safe to retry even when the exact status (often 500) is not in `statuses`. Defaults to true.
     */
    retryNonJsonServerErrors?: boolean;
    /**
     * Retry network failures thrown by fetch. Defaults to true.
     */
    retryOnConnectionError?: boolean;
    /**
     * Initial backoff delay in milliseconds. Defaults to 250.
     */
    baseDelayMs?: number;
    /**
     * Maximum client-computed backoff in milliseconds. Server retry floors may exceed this.
     * Defaults to 4000.
     */
    maxDelayMs?: number;
    /**
     * Use full jitter for client-computed backoff. Server floors get up to 10% additional jitter,
     * capped at 1000 ms, and are never shortened. Defaults to true.
     */
    jitter?: boolean;
    /**
     * Have SDK methods whose request body accepts an `idempotency_key` generate one when the caller
     * set none, so this policy can retry those POSTs without the server repeating them: a retry with
     * the same key returns what the first attempt created. Every attempt of a call reuses its key.
     * Other POSTs are unaffected. Defaults to false.
     */
    idempotencyKeys?: boolean;
}

/** Generate a fresh idempotency key (a random UUID). */
export function generateIdempotencyKey(): string {
    const cryptoImpl = globalThis.crypto;
    if (typeof cryptoImpl.randomUUID === 'function') {
        return cryptoImpl.randomUUID();
    }
    // Browsers expose `randomUUID` only in secure contexts; `getRandomValues` is always there.
    const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type NormalizedRetryPolicy = {
    attempts: number;
    methods: Set<string>;
    statuses: Set<number>;
    retryNonJsonServerErrors: boolean;
    retryOnConnectionError: boolean;
    baseDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
};

/**
 * Auto-retry for rate-limiter pacing responses (server contract: a 429 with
 * `x-ratelimit-reason: pacing` and a precise `x-ratelimit-retry-ms`). A pacing 429 is emitted by
 * the rate limiter BEFORE any handler runs, so replaying is safe for every method, POST included.
 * Quota rejections (`x-ratelimit-reason: quota`) are never auto-retried.
 *
 * Enabled by default; independent from the opt-in IRequestRetryPolicy (pacing retries do not
 * consume policy attempts).
 */
export interface IPacingRetryPolicy {
    /** Defaults to true. */
    enabled?: boolean;
    /** Hints above this are not auto-waited (the caller sees the 429). Defaults to 3000. */
    maxWaitMs?: number;
    /** Maximum pacing retries per request. Defaults to 2. */
    attempts?: number;
}

type NormalizedPacingPolicy = { maxWaitMs: number; attempts: number };

const DEFAULT_PACING_MAX_WAIT_MS = 3000;
const DEFAULT_PACING_ATTEMPTS = 2;
// setTimeout overflows above this value and would otherwise turn a long server floor into 1 ms.
const MAX_RETRY_TIMER_MS = 2_147_483_647;
const RATELIMIT_REASON_HEADER = 'x-ratelimit-reason';
const RATELIMIT_RETRY_MS_HEADER = 'x-ratelimit-retry-ms';

function normalizePacingPolicy(
    policy: IPacingRetryPolicy | false | null | undefined,
): NormalizedPacingPolicy | undefined {
    if (policy === false || policy === null || policy?.enabled === false) {
        return undefined;
    }
    return {
        maxWaitMs: Math.max(0, policy?.maxWaitMs ?? DEFAULT_PACING_MAX_WAIT_MS),
        attempts: Math.max(0, Math.floor(policy?.attempts ?? DEFAULT_PACING_ATTEMPTS)),
    };
}

const DEFAULT_RETRY_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'];
const DEFAULT_RETRY_STATUSES = [502, 503, 504];
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;
const DEFAULT_RETRY_MAX_DELAY_MS = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
}

export interface IRequestParams {
    query?: Record<string, IPrimitives> | null;
    headers?: Record<string, string> | null;
    /*
     * custom response reader. The default is to read a JSON object using the jsonParse method
     * The reader function is called with the client as the `this` context
     * This can be an async function (i.e. return a promise). If a promise is returned
     * it will wait for the promise to resolve before returning the result
     *
     * If set to 'sse' the response will be treated as a server-sent event stream
     * and the request will return a Promise<ReadableStream<ServerSentEvent>> object
     */
    reader?: 'sse' | ((response: Response) => unknown);
    /**
     * Set to false to disable automatic JSON payload serialization
     * If you need to post other data than a json payload, set this to false and use the `payload` property to set the desired payload
     */
    jsonPayload?: boolean;
    /**
     * Opt-in retry policy for this request. Retries are disabled by default.
     * Set to false to disable a client-level retry policy for this request.
     */
    retryPolicy?: IRequestRetryPolicy | false | null;
    /**
     * Per-request timeout in milliseconds. Aborts the whole request — connection, response headers,
     * AND body consumption (JSON parse) — via a browser-standard AbortSignal. A positive number sets
     * the timeout; `false`/`null`/`0` disables it for this request (overriding any client default).
     * When omitted, the client-level default (`withTimeout` / `defaultTimeoutMs`) applies.
     * Not applied to SSE (`reader: 'sse'`) requests, which are long-lived by design.
     */
    timeoutMs?: number | false | null;
    /**
     * Caller-supplied AbortSignal. Merged with the timeout signal — whichever aborts first wins.
     */
    signal?: AbortSignal;
    /**
     * Per-request override for pacing auto-retry (enabled by default at the client level).
     * Set to false to surface pacing 429s to the caller.
     */
    pacingRetry?: IPacingRetryPolicy | false | null;
    /**
     * Set to false to send this GET on its own even when in-flight deduplication is enabled on the
     * client (see `ClientBase.withInFlightDeduplication`) and an identical GET is already in flight.
     */
    dedupe?: boolean;
}

/**
 * How long a GET can be joined after it starts, by default. Components that load the same resource while rendering one
 * page start their requests within a few milliseconds of each other; a short window shares those without handing a
 * later, deliberate refetch (after an event, or a change made elsewhere) a response that started before the change.
 */
export const DEFAULT_IN_FLIGHT_JOIN_WINDOW_MS = 50;

/** An identical GET that started while another was in flight, reported to `InFlightRequestsOptions.onDuplicate`. */
export interface DuplicateRequest {
    method: 'GET';
    /** The request URL without its query string. */
    path: string;
    /** Milliseconds since the in-flight request started. */
    delayMs: number;
    /** Whether the duplicate joined the in-flight request (it started within the join window) or was sent. */
    shared: boolean;
}

export interface InFlightRequestsOptions {
    /** How long a GET can be joined after it starts. Defaults to `DEFAULT_IN_FLIGHT_JOIN_WINDOW_MS`. */
    joinWindowMs?: number;
    /**
     * Called for every GET that starts while an identical one is in flight, whether it is shared or sent. Duplicates
     * usually mean several callers load the same resource and could share it; use this to find them. Errors it
     * throws are ignored.
     */
    onDuplicate?: (duplicate: DuplicateRequest) => void;
}

/**
 * The GET requests currently in flight, keyed by write generation, URL, headers and credential. A client that has one
 * shares a single request between concurrent identical GETs instead of sending each (see
 * `ClientBase.withInFlightDeduplication`).
 *
 * It is not a cache: an entry lives only while its request is in flight. Any other request (a write) calls
 * `invalidate()`, which starts a new generation, so a GET issued after a write never joins one issued before it.
 * A request can only be joined during `joinWindowMs` after it starts, so a request that stalls cannot hold back
 * later identical GETs.
 */
export class InFlightRequests {
    private readonly requests = new Map<string, { request: Promise<unknown>; startedAt: number }>();
    private writes = 0;
    readonly joinWindowMs: number;
    private readonly onDuplicate?: (duplicate: DuplicateRequest) => void;

    constructor(options: InFlightRequestsOptions = {}) {
        this.joinWindowMs = options.joinWindowMs ?? DEFAULT_IN_FLIGHT_JOIN_WINDOW_MS;
        this.onDuplicate = options.onDuplicate;
    }

    /**
     * Incremented by every `invalidate()`. A GET captures it when it is called (before any await) and makes it part of
     * its key, so a GET issued before a write never shares with one issued after it, even when either resolves its
     * credential late. Entries of older generations stay until they settle, so GETs issued before the write can still
     * share among themselves.
     */
    get generation(): number {
        return this.writes;
    }

    /** Number of requests currently in flight. */
    get size(): number {
        return this.requests.size;
    }

    /**
     * The in-flight request for `key`, if it started less than `joinWindowMs` ago. When one with that key is in flight,
     * the call is reported to `onDuplicate` as shared or not; `url` is reported without its query string.
     */
    get(key: string, url: string): Promise<unknown> | undefined {
        const entry = this.requests.get(key);
        if (!entry) return undefined;
        const delayMs = Date.now() - entry.startedAt;
        const shared = delayMs < this.joinWindowMs;
        if (this.onDuplicate) {
            try {
                this.onDuplicate({ method: 'GET', path: url.split('?')[0], delayMs, shared });
            } catch {
                // Observability must never fail the request.
            }
        }
        return shared ? entry.request : undefined;
    }

    set(key: string, request: Promise<unknown>): void {
        this.requests.set(key, { request, startedAt: Date.now() });
    }

    /** Removes `key` only while it still maps to `request`, so a settled request cannot evict a newer one. */
    release(key: string, request: Promise<unknown>): void {
        if (this.requests.get(key)?.request === request) this.requests.delete(key);
    }

    /** Starts a new generation: no GET issued from now on can join a request issued before. */
    invalidate(): void {
        this.writes++;
    }
}

export interface IRequestParamsWithPayload extends IRequestParams {
    payload?: object | BodyInit | null;
}

export function fetchPromise(fetchImpl?: FETCH_FN | Promise<FETCH_FN>) {
    if (fetchImpl !== undefined) {
        return Promise.resolve(fetchImpl);
    } else if (typeof globalThis.fetch === 'function') {
        return Promise.resolve(globalThis.fetch);
    } else {
        // install an error impl
        return Promise.resolve(() => {
            throw new Error('No Fetch implementation found');
        });
    }
}

function isInvalidJsonPayload(payload: unknown) {
    return isRecord(payload) && payload.error === 'Not a valid JSON payload' && typeof payload.text === 'string';
}

function isReplayableBody(body: BodyInit | undefined) {
    return !body || typeof ReadableStream === 'undefined' || !(body instanceof ReadableStream);
}

/**
 * True for a 5xx whose Content-Type is not JSON. The application serializes its errors as JSON, so a
 * non-JSON 5xx (HTML/text, or no content-type) is an edge/LB/gateway failure — e.g. a Cloud Run
 * "no available instance" or GFE "try again in 30 seconds" page — which is transient and retryable.
 * Reads only headers (no body consumption), so it is safe to call before deciding to retry.
 */
function isNonJsonServerError(res: Response): boolean {
    if (res.status < 500) {
        return false;
    }
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    return !contentType.includes('json');
}

function normalizeRetryPolicy(policy: IRequestRetryPolicy): NormalizedRetryPolicy {
    const attempts = Math.max(1, Math.floor(policy.attempts ?? DEFAULT_RETRY_ATTEMPTS));
    const baseDelayMs = Math.max(0, policy.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS);
    const maxDelayMs = Math.max(baseDelayMs, policy.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS);
    return {
        attempts,
        methods: new Set((policy.methods ?? DEFAULT_RETRY_METHODS).map((method) => method.toUpperCase())),
        statuses: new Set(policy.statuses ?? DEFAULT_RETRY_STATUSES),
        retryNonJsonServerErrors: policy.retryNonJsonServerErrors ?? true,
        retryOnConnectionError: policy.retryOnConnectionError ?? true,
        baseDelayMs,
        maxDelayMs,
        jitter: policy.jitter ?? true,
    };
}

function retryAfterDelayMs(res: Response): number | undefined {
    let minimum: number | undefined;
    for (const header of ['x-retry-after-ms', RATELIMIT_RETRY_MS_HEADER]) {
        const raw = res.headers.get(header);
        if (!raw) continue;
        const value = Number(raw);
        if (Number.isFinite(value) && value >= 0) {
            minimum = Math.max(minimum ?? 0, value);
        }
    }
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds)) {
            if (seconds >= 0) minimum = Math.max(minimum ?? 0, seconds * 1000);
        } else {
            const retryAt = Date.parse(retryAfter);
            if (!Number.isNaN(retryAt)) minimum = Math.max(minimum ?? 0, retryAt - Date.now());
        }
    }
    return minimum;
}

function pacingDelayMs(res: Response, pacing: NormalizedPacingPolicy): number | undefined {
    if (res.status !== 429 || res.headers.get(RATELIMIT_REASON_HEADER) !== 'pacing') {
        return undefined;
    }
    const delay = pacingRetryAfterDelayMs(res);
    if (delay === undefined || delay > pacing.maxWaitMs || delay > MAX_RETRY_TIMER_MS) {
        return undefined;
    }
    return delay;
}

function pacingRetryAfterDelayMs(res: Response): number | undefined {
    // Recognised pacing responses define this as the authoritative hint, already jittered by
    // the server. Retry-After is its rounded compatibility fallback for ordinary HTTP clients.
    const raw = res.headers.get(RATELIMIT_RETRY_MS_HEADER)?.trim();
    const exact = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(exact) && exact >= 0 ? exact : retryAfterDelayMs(res);
}

function rateLimitMetadata(res: Response): RateLimitMetadata | undefined {
    const reason = res.headers.get(RATELIMIT_REASON_HEADER);
    if (res.status !== 429 || (reason !== 'pacing' && reason !== 'quota')) return undefined;
    const retryAfterMs = reason === 'pacing' ? pacingRetryAfterDelayMs(res) : retryAfterDelayMs(res);
    if (retryAfterMs === undefined) return undefined;
    return {
        reason,
        retryAfterMs,
        resource: res.headers.get('x-ratelimit-resource') ?? undefined,
        window: res.headers.get('x-ratelimit-window') ?? undefined,
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(policy: NormalizedRetryPolicy, attempt: number, res?: Response): number {
    const retryAfter = res ? retryAfterDelayMs(res) : undefined;
    if (retryAfter !== undefined) {
        const jitterRange = Math.min(retryAfter * 0.1, 1000, Math.max(0, MAX_RETRY_TIMER_MS - retryAfter));
        return retryAfter + (policy.jitter ? Math.floor(Math.random() * jitterRange) : 0);
    }
    const delay = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
    return policy.jitter ? Math.floor(Math.random() * delay) : delay;
}

function toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
}

/**
 * A 2xx response whose body could not be read, e.g. because the page navigated away mid-download.
 * There is no result to hand back, so it fails like a connection error instead.
 */
class ResponseBodyError extends Error {
    constructor(err: unknown) {
        super(`Unable to load response content: ${toError(err).message}`);
        this.name = 'ResponseBodyError';
    }
}

/**
 * True for an AbortSignal-driven failure (caller abort or our timeout). Checks `name` rather than
 * `instanceof Error` because runtimes surface these as a `DOMException` (`TimeoutError`/`AbortError`),
 * which is not always an `Error` subclass in browsers.
 */
function isAbortError(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        ((err as { name: unknown }).name === 'TimeoutError' || (err as { name: unknown }).name === 'AbortError')
    );
}

/**
 * True only for a CALLER abort — `controller.abort()` on the signal they supplied. The runtime rejects
 * with the signal's reason, which is an `AbortError` only when the caller gave none: a signal aborted
 * with a reason rejects with that reason, whatever its type. So the caller's own signal is checked as
 * well as the error name. Our own `timeoutMs` surfaces as `TimeoutError` and
 * never aborts the caller's signal, so it is deliberately excluded: a timeout is a transient failure,
 * and `createRequestInit()` mints a fresh timeout signal per attempt, so retrying one is both
 * meaningful and intended. A caller's signal stays aborted across attempts, so retrying that can only
 * burn the budget.
 */
function isCallerAbortError(err: unknown, callerSignal: AbortSignal | undefined): boolean {
    if (callerSignal?.aborted) return true;
    return typeof err === 'object' && err !== null && 'name' in err && (err as { name: unknown }).name === 'AbortError';
}

/**
 * Browser + Node safe `AbortSignal.timeout(ms)`, with a fallback for runtimes that lack it.
 */
function timeoutSignal(ms: number): AbortSignal {
    const timeoutFn = (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout;
    if (typeof timeoutFn === 'function') {
        return timeoutFn(ms);
    }
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('The operation timed out', 'TimeoutError')), ms);
    return controller.signal;
}

/**
 * Merge abort signals (caller + timeout). Uses the standard `AbortSignal.any` when available, with a
 * manual fallback for older runtimes. Returns undefined when there is nothing to combine.
 */
function combineAbortSignals(signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
    const list = signals.filter((s): s is AbortSignal => !!s);
    if (list.length === 0) {
        return undefined;
    }
    if (list.length === 1) {
        return list[0];
    }
    const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
    if (typeof anyFn === 'function') {
        return anyFn(list);
    }
    const controller = new AbortController();
    for (const s of list) {
        if (s.aborted) {
            controller.abort(s.reason);
            break;
        }
        s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
    }
    return controller.signal;
}

async function discardBody(res: Response) {
    try {
        await res.body?.cancel();
    } catch {
        // Ignore body cleanup failures while retrying the original request.
    }
}

/** Synchronous logical-call identity, captured before authentication and reused by transport retries. */
export type RequestIdentityProvider = (request: { url: string; method: string; body?: BodyInit }) => string | undefined;

export abstract class ClientBase {
    _fetch: Promise<FETCH_FN>;
    baseUrl: string;
    errorFactory: (err: RequestError) => Error = (err) => err;
    verboseErrors = true;
    retryPolicy?: IRequestRetryPolicy;
    pacingRetry?: IPacingRetryPolicy | false;
    requestIdentity?: RequestIdentityProvider;
    defaultTimeoutMs?: number;
    /** In-flight GET deduplication, off unless turned on with `withInFlightDeduplication`. */
    inFlight?: InFlightRequests;

    abstract get headers(): Record<string, string>;

    constructor(baseUrl: string, fetchImpl?: FETCH_FN | Promise<FETCH_FN>) {
        this.baseUrl = removeTrailingSlash(baseUrl);
        this._fetch = fetchPromise(fetchImpl);
    }

    /**
     * Can be subclassed to map to custom errors
     * @param err
     */
    throwError(err: RequestError): never {
        throw this.errorFactory(err);
    }

    withPacingRetry(policy?: IPacingRetryPolicy | false | null): this {
        this.pacingRetry = policy === null ? undefined : policy;
        return this;
    }

    withRetryPolicy(policy?: IRequestRetryPolicy | null): this {
        this.retryPolicy = policy || undefined;
        return this;
    }

    getRetryPolicy(): IRequestRetryPolicy | undefined {
        return this.retryPolicy;
    }

    /**
     * Set a default request timeout (ms) applied to every request unless overridden per-request via
     * `timeoutMs`. Pass `false`/`null`/`0` to clear it. The timeout aborts the whole request
     * (connection + response headers + body consumption) via AbortSignal.
     */
    withTimeout(timeoutMs?: number | false | null): this {
        this.defaultTimeoutMs = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : undefined;
        return this;
    }

    getTimeout(): number | undefined {
        return this.defaultTimeoutMs;
    }

    /**
     * Share one request between concurrent identical GETs (same URL, headers and credential) instead of sending each.
     * A caller that joins an in-flight GET gets its own copy of the parsed result, or the same error. Off by default.
     *
     * Only plain JSON GETs are shared: not SSE or custom readers, not requests with a caller AbortSignal (one caller
     * aborting must not abort another), not requests with their own `timeoutMs`, `retryPolicy` or `pacingRetry`
     * (a joiner would inherit the first caller's), and not requests with `dedupe: false`. A request can be joined only
     * during the table's join window (50 ms by default). Any other method starts a new generation when it starts and
     * when it settles, so reads issued after a write always reach the server.
     *
     * Only turn it on when every caller of this client may see every other caller's GET responses: the key covers the
     * URL, headers and credential, but not what `createRequest()`, an `onRequest` hook or a custom `fetch` adds per
     * call, and a joiner is not given its own `requestIdentity`. Do not use it for GETs with side effects.
     *
     * Pass an `InFlightRequests` to share one table between clients (e.g. two services behind one session), so a
     * write through either invalidates both. Pass `false` to turn it off for this client, or set `dedupe: false` on one
     * request. Clients that delegate to a parent (API topics) always use the parent's table.
     */
    withInFlightDeduplication(enabled: boolean | InFlightRequests = true): this {
        this.inFlight = enabled instanceof InFlightRequests ? enabled : enabled ? new InFlightRequests() : undefined;
        return this;
    }

    getInFlightRequests(): InFlightRequests | undefined {
        return this.inFlight;
    }

    /**
     * The credential a request will carry when none is set in its headers, so requests made with different
     * credentials are never shared. Clients that add authentication in `createRequest()` override this.
     */
    resolveRequestAuthorization(): Promise<string | undefined> {
        return Promise.resolve(undefined);
    }

    /**
     * Resolve the effective timeout for a request: per-request `timeoutMs` wins (a positive number
     * sets it; `false`/`null`/`0` disables it), otherwise the client default applies. SSE streams are
     * never given a total-request timeout.
     */
    protected resolveTimeout(params: IRequestParams | undefined): number | undefined {
        if (params?.reader === 'sse') {
            return undefined;
        }
        const requestTimeout = params?.timeoutMs;
        if (requestTimeout === false || requestTimeout === null) {
            return undefined;
        }
        if (typeof requestTimeout === 'number') {
            return requestTimeout > 0 ? requestTimeout : undefined;
        }
        const clientTimeout = this.getTimeout();
        return clientTimeout && clientTimeout > 0 ? clientTimeout : undefined;
    }

    /**
     * Resolve a path to a full URL. If the path is already an absolute URL
     * (starts with http:// or https://), it is returned as-is.
     */
    getUrl(path: string) {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return removeTrailingSlash(path);
        }
        return removeTrailingSlash(join(this.baseUrl, path));
    }

    get<T = unknown>(path: string, params?: IRequestParams): Promise<T> {
        return this.request<T>('GET', path, params);
    }

    del<T = unknown>(path: string, params?: IRequestParams): Promise<T> {
        return this.request<T>('DELETE', path, params);
    }

    delete(path: string, params?: IRequestParams): Promise<unknown> {
        return this.request('DELETE', path, params);
    }

    post<T = unknown>(path: string, params?: IRequestParamsWithPayload): Promise<T> {
        return this.request<T>('POST', path, params);
    }

    put<T = unknown>(path: string, params?: IRequestParamsWithPayload): Promise<T> {
        return this.request<T>('PUT', path, params);
    }

    /**
     * You can customize the json parser by overriding this method
     * @param text
     * @returns
     */
    jsonParse(text: string): unknown {
        return JSON.parse(text);
    }

    /**
     * Can be overridden to create the request
     * @param fetch
     * @param url
     * @param init
     * @returns
     */
    createRequest(url: string, init: RequestInit): Promise<Request> {
        return Promise.resolve(new Request(url, init));
    }

    /** Override at the caller boundary when handled transport failures have their own logging. */
    handleConnectionError(error: ConnectionError): void {
        console.error(error.message, error.payload);
    }

    handleFetchResponse(_req: Request, _res: Response): void {}

    createServerError(req: Request, res: Response, payload: unknown): RequestError {
        const status = res.status;
        let message = `Server Error: ${status}`;
        if (payload) {
            if (isInvalidJsonPayload(payload)) {
                message += res.statusText ? ` ${res.statusText}` : '';
                message += ': non-JSON response';
            } else if (isRecord(payload) && payload.message) {
                message = String(payload.message);
            } else if (isRecord(payload) && payload.error) {
                if (typeof payload.error === 'string') {
                    message = String(payload.error);
                } else if (isRecord(payload.error) && typeof payload.error.message === 'string') {
                    message = payload.error.message;
                }
            }
        }
        const rateLimit = rateLimitMetadata(res);
        const error = new ServerError(
            message,
            req,
            res.status,
            payload,
            this.verboseErrors,
            rateLimit,
            rateLimit?.retryAfterMs ?? retryAfterDelayMs(res),
        );
        if (
            res.status === 503 &&
            res.headers.get(RATELIMIT_REASON_HEADER) === 'dependency_unavailable' &&
            error.retryAfterMs !== undefined
        )
            error.dependencyUnavailable = { retryAfterMs: error.retryAfterMs };
        return error;
    }

    async readJSONPayload(res: Response) {
        return res
            .text()
            .then((text) => {
                if (!text) {
                    return undefined;
                } else {
                    try {
                        return this.jsonParse(text);
                    } catch (err: unknown) {
                        return {
                            status: res.status,
                            error: 'Not a valid JSON payload',
                            message: err instanceof Error ? err.message : String(err),
                            text: text,
                        };
                    }
                }
            })
            .catch((err: unknown) => {
                // A timeout/abort during body consumption is a real failure — surface it instead of
                // swallowing it into an error payload that would otherwise be returned as the result.
                if (isAbortError(err)) {
                    throw err;
                }
                // Same for a successful response: the error payload would be returned as the result.
                if (res.ok) {
                    throw new ResponseBodyError(err);
                }
                return {
                    status: res.status,
                    error: 'Unable to load response content',
                    message: err instanceof Error ? err.message : String(err),
                };
            });
    }

    /**
     * Subclasses You can override this to do something with the response
     * @param res
     */
    handleResponse<T = unknown>(
        req: Request,
        res: Response,
        params: IRequestParamsWithPayload | undefined,
    ): T | Promise<T> {
        if (params?.reader) {
            if (params.reader === 'sse') {
                return sse(res) as T;
            } else {
                return params.reader.call(this, res) as T | Promise<T>;
            }
        } else {
            return this.readJSONPayload(res).then((payload) => {
                if (res.ok) {
                    return payload as T;
                } else {
                    this.throwError(this.createServerError(req, res, payload));
                }
            });
        }
    }

    async request<T = unknown>(method: string, path: string, params?: IRequestParamsWithPayload): Promise<T> {
        const inFlight = this.getInFlightRequests();
        if (!inFlight) {
            return this.sendRequest<T>(method, path, params);
        }
        const normalizedMethod = method.toUpperCase();
        if (normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD' && normalizedMethod !== 'OPTIONS') {
            // A write: no GET started before it (or while it runs) may be reused after it.
            inFlight.invalidate();
            try {
                return await this.sendRequest<T>(method, path, params);
            } finally {
                inFlight.invalidate();
            }
        }
        if (
            normalizedMethod !== 'GET' ||
            params?.dedupe === false ||
            params?.signal ||
            params?.reader ||
            params?.payload !== undefined ||
            // Per-request transport options would otherwise be inherited by joiners from the first caller.
            params?.timeoutMs !== undefined ||
            params?.retryPolicy !== undefined ||
            params?.pacingRetry !== undefined
        ) {
            return this.sendRequest<T>(method, path, params);
        }
        // Captured before any await: a write that starts while this call resolves its credential bumps the generation.
        const generation = inFlight.generation;
        const url = this.buildRequestUrl(path, params);
        const headers = this.buildRequestHeaders(params);
        // The credential goes into the headers, which are part of the key, so requests carrying different credentials
        // are never shared; and it is the one sent, since createRequest() does not resolve a credential already in
        // the headers again. If it cannot be resolved, send unshared and let the request fail where it always has.
        if (!headers.authorization) {
            const credential = await this.resolveRequestAuthorization().catch(() => null);
            if (credential === null) {
                return this.sendRequest<T>(method, path, params, { url, headers });
            }
            if (credential) headers.authorization = credential;
        }
        const key = JSON.stringify([
            generation,
            url,
            Object.entries(headers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        ]);
        const pending = inFlight.get(key, url);
        if (pending !== undefined) {
            // Joiners get their own copy, so one caller mutating its result cannot change another's. With a custom
            // jsonParse, class instances reach joiners as plain-object copies; a result that cannot be cloned at all
            // (one holding functions) is fetched again instead of failing.
            return pending.then((result) => {
                try {
                    return structuredClone(result) as T;
                } catch {
                    return this.sendRequest<T>(method, path, params, { url, headers });
                }
            });
        }
        const request: Promise<T> = this.sendRequest<T>(method, path, params, { url, headers });
        inFlight.set(key, request);
        const release = () => inFlight.release(key, request);
        request.then(release, release);
        // The first caller gets the original object. `request()` is async, so its continuation runs only after every
        // joiner has cloned the result: mutating it straight after `await` cannot leak into a joiner's copy (tested).
        return request;
    }

    /** The full request URL for `path` and `params.query`. */
    protected buildRequestUrl(path: string, params?: IRequestParams): string {
        const url = this.getUrl(path);
        return params?.query ? `${url}?${buildQueryString(params.query)}` : url;
    }

    /** The client headers merged with `params.headers` (lowercased keys), before authentication is added. */
    protected buildRequestHeaders(params?: IRequestParams): Record<string, string> {
        const headers = this.headers ? Object.assign({}, this.headers) : {};
        const paramsHeaders = params?.headers;
        if (paramsHeaders) {
            for (const key in paramsHeaders) {
                headers[key.toLowerCase()] = paramsHeaders[key];
            }
        }
        return headers;
    }

    /**
     * Sends one request, with retries, pacing and timeouts. `request()` adds in-flight deduplication on top and
     * passes the URL and headers it already built as `prepared`.
     */
    protected async sendRequest<T = unknown>(
        method: string,
        path: string,
        params?: IRequestParamsWithPayload,
        prepared?: { url: string; headers: Record<string, string> },
    ): Promise<T> {
        const url = prepared?.url ?? this.buildRequestUrl(path, params);
        const headers = prepared ? Object.assign({}, prepared.headers) : this.buildRequestHeaders(params);
        let body: BodyInit | undefined;
        const payload = params?.payload;
        if (payload) {
            if (params && params.jsonPayload === false) {
                body = payload as BodyInit;
            } else {
                body = typeof payload !== 'string' ? JSON.stringify(payload) : payload;
                if (!('content-type' in headers)) {
                    headers['content-type'] = 'application/json';
                }
            }
        }
        // When using SSE reader, ensure the Accept header requests event-stream
        if (params?.reader === 'sse') {
            headers.accept = 'text/event-stream';
        }

        const normalizedMethod = method.toUpperCase();
        const identity = this.requestIdentity?.({ url, method: normalizedMethod, body });
        if (identity) headers['x-request-id'] = identity;
        // Resolved once; createRequestInit() then mints a FRESH timeout signal per attempt so each
        // retry gets its own deadline. The signal is set on the Request, so it bounds the connection,
        // the wait for response headers, AND body consumption (handleResponse reads res.text()).
        const timeoutMs = this.resolveTimeout(params);
        const createRequestInit = (): RequestInit => {
            const signal = combineAbortSignals([params?.signal, timeoutMs ? timeoutSignal(timeoutMs) : undefined]);
            const init: RequestInit = {
                method: normalizedMethod,
                headers: Object.assign({}, headers),
                body: body,
            };
            if (signal) {
                init.signal = signal;
            }
            return init;
        };
        const retryPolicy = this.resolveRetryPolicy(params);
        const pacing =
            params?.reader === 'sse' ? undefined : normalizePacingPolicy(params?.pacingRetry ?? this.pacingRetry);
        const fetch = await this._fetch;
        const replayableBody = isReplayableBody(body);

        // Unified loop: `attempt` budgets the opt-in retry policy; pacing auto-retries (server
        // says "come back in N ms" via a pacing 429 emitted before any handler ran) have their
        // own independent budget and exact server-provided wait.
        let attempt = 0;
        let pacingAttemptsUsed = 0;
        let lastReq: Request | undefined;
        while (true) {
            const req = await this.createRequest(url, createRequestInit());
            lastReq = req;
            let res: Response;
            try {
                res = await fetch(req);
            } catch (err: unknown) {
                // A caller abort is their own doing, and
                // retrying cannot help: their signal stays aborted, so each further attempt rejects at
                // once. A TIMEOUT is not included — it is transient, and each attempt gets a fresh
                // timeout signal, so it retries as before. Still thrown, wrapping the original.
                const aborted = isCallerAbortError(err, params?.signal);
                if (
                    aborted ||
                    !retryPolicy ||
                    !this.shouldRetryConnectionError(retryPolicy, normalizedMethod, attempt, replayableBody)
                ) {
                    const connectionError = new ConnectionError(req, toError(err));
                    if (!aborted) this.handleConnectionError(connectionError);
                    this.throwError(connectionError);
                }
                await this.waitBeforeRetry(retryPolicy, attempt);
                attempt++;
                continue;
            }
            this.handleFetchResponse(req, res);
            if (pacing && pacingAttemptsUsed < pacing.attempts && replayableBody) {
                const delay = pacingDelayMs(res, pacing);
                if (delay !== undefined) {
                    await discardBody(res);
                    await sleep(delay);
                    pacingAttemptsUsed++;
                    continue;
                }
            }
            if (retryPolicy && this.shouldRetryResponse(retryPolicy, normalizedMethod, attempt, replayableBody, res)) {
                const delay = retryDelayMs(retryPolicy, attempt, res);
                if (delay <= MAX_RETRY_TIMER_MS) {
                    await discardBody(res);
                    await sleep(delay);
                    attempt++;
                    continue;
                }
            }
            if (retryPolicy && attempt >= retryPolicy.attempts) {
                break;
            }
            try {
                return await this.handleResponse<T>(req, res, params);
            } catch (err: unknown) {
                // Body consumption can time out or break after fetch has returned the headers. Preserve
                // HTTP/custom-reader errors, and do not replay a request already accepted upstream.
                if (!isAbortError(err) && !(err instanceof ResponseBodyError)) throw err;
                const connectionError = new ResponseReadError(req, toError(err), res.status);
                if (!isCallerAbortError(err, params?.signal)) this.handleConnectionError(connectionError);
                this.throwError(connectionError);
            }
        }

        if (lastReq) {
            this.throwError(
                new ConnectionError(lastReq, new Error(`Retry attempts exhausted for ${normalizedMethod} ${url}`)),
            );
        }
        throw new Error(`Retry attempts exhausted for ${normalizedMethod} ${url}`);
    }

    protected resolveRetryPolicy(params: IRequestParamsWithPayload | undefined): NormalizedRetryPolicy | undefined {
        if (params?.reader === 'sse' || params?.retryPolicy === false || params?.retryPolicy === null) {
            return undefined;
        }
        const requestPolicy = params?.retryPolicy;
        const clientPolicy = this.getRetryPolicy();
        if (!requestPolicy && !clientPolicy) {
            return undefined;
        }
        const policy = normalizeRetryPolicy({
            ...clientPolicy,
            ...requestPolicy,
        });
        return policy.attempts > 1 ? policy : undefined;
    }

    private shouldRetryResponse(
        policy: NormalizedRetryPolicy,
        method: string,
        attempt: number,
        replayableBody: boolean,
        res: Response,
    ) {
        const retryableStatus =
            policy.statuses.has(res.status) || (policy.retryNonJsonServerErrors && isNonJsonServerError(res));
        return attempt < policy.attempts - 1 && replayableBody && policy.methods.has(method) && retryableStatus;
    }

    private shouldRetryConnectionError(
        policy: NormalizedRetryPolicy,
        method: string,
        attempt: number,
        replayableBody: boolean,
    ) {
        return (
            attempt < policy.attempts - 1 &&
            replayableBody &&
            policy.retryOnConnectionError &&
            policy.methods.has(method)
        );
    }

    private waitBeforeRetry(policy: NormalizedRetryPolicy, attempt: number) {
        return sleep(retryDelayMs(policy, attempt));
    }

    /**
     * Perform a request and consume the response as an SSE stream.
     * Calls `onEvent` for each parsed SSE event, then returns the last event.
     *
     * @param method HTTP method
     * @param path URL path (relative to baseUrl) or absolute URL (http:// or https://)
     * @param params Request parameters (payload, headers, query)
     * @param onEvent Callback for each SSE event
     * @returns The last SSE event received, or undefined if the stream was empty
     */
    async sseRequest(
        method: string,
        path: string,
        params: IRequestParamsWithPayload | undefined,
        onEvent: (event: ServerSentEvent) => void,
    ): Promise<ServerSentEvent | undefined> {
        const stream = (await this.request(method, path, {
            ...params,
            reader: 'sse',
        })) as ReadableStream<ServerSentEvent>;

        const reader = stream.getReader();
        let lastEvent: ServerSentEvent | undefined;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                lastEvent = value;
                onEvent(value);
            }
        } finally {
            reader.releaseLock();
        }

        return lastEvent;
    }

    /**
     * Expose the fetch method
     * @param input
     * @param init
     * @returns
     */
    fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
        return this._fetch.then((fetch) => fetch(input, init));
    }
}
