import { ConnectionError, type RequestError, ServerError } from "./errors.js";
import { sse, type ServerSentEvent } from "./sse/index.js";
import { buildQueryString, join, removeTrailingSlash } from "./utils.js";

export type FETCH_FN = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
type IPrimitives = string | number | boolean | null | undefined | string[] | number[] | boolean[];

export interface IRequestRetryPolicy {
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
     * Retry network failures thrown by fetch. Defaults to true.
     */
    retryOnConnectionError?: boolean;
    /**
     * Initial backoff delay in milliseconds. Defaults to 250.
     */
    baseDelayMs?: number;
    /**
     * Maximum backoff delay in milliseconds. Defaults to 4000.
     */
    maxDelayMs?: number;
    /**
     * Use full jitter for backoff delays. Defaults to true.
     */
    jitter?: boolean;
}

type NormalizedRetryPolicy = {
    attempts: number;
    methods: Set<string>;
    statuses: Set<number>;
    retryOnConnectionError: boolean;
    baseDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
};

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
    jsonPayload?: boolean
    /**
     * Opt-in retry policy for this request. Retries are disabled by default.
     * Set to false to disable a client-level retry policy for this request.
     */
    retryPolicy?: IRequestRetryPolicy | false | null;
}

export interface IRequestParamsWithPayload extends IRequestParams {
    payload?: object | BodyInit | null;
}

export function fetchPromise(fetchImpl?: FETCH_FN | Promise<FETCH_FN>) {
    if (fetchImpl) {
        return Promise.resolve(fetchImpl);
    } else if (typeof globalThis.fetch === 'function') {
        return Promise.resolve(globalThis.fetch);
    } else {
        // install an error impl
        return Promise.resolve(() => {
            throw new Error('No Fetch implementation found')
        });
    }
}

function isInvalidJsonPayload(payload: unknown) {
    return isRecord(payload) && payload.error === "Not a valid JSON payload" && typeof payload.text === "string";
}

function isReplayableBody(body: BodyInit | undefined) {
    return !body || typeof ReadableStream === 'undefined' || !(body instanceof ReadableStream);
}

function normalizeRetryPolicy(policy: IRequestRetryPolicy): NormalizedRetryPolicy {
    const attempts = Math.max(1, Math.floor(policy.attempts ?? DEFAULT_RETRY_ATTEMPTS));
    const baseDelayMs = Math.max(0, policy.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS);
    const maxDelayMs = Math.max(baseDelayMs, policy.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS);
    return {
        attempts,
        methods: new Set((policy.methods ?? DEFAULT_RETRY_METHODS).map(method => method.toUpperCase())),
        statuses: new Set(policy.statuses ?? DEFAULT_RETRY_STATUSES),
        retryOnConnectionError: policy.retryOnConnectionError ?? true,
        baseDelayMs,
        maxDelayMs,
        jitter: policy.jitter ?? true,
    };
}

function retryAfterDelayMs(res: Response): number | undefined {
    const retryAfter = res.headers.get('retry-after');
    if (!retryAfter) {
        return undefined;
    }
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds * 1000;
    }
    const retryAt = Date.parse(retryAfter);
    if (!Number.isNaN(retryAt)) {
        return Math.max(0, retryAt - Date.now());
    }
    return undefined;
}

function retryDelayMs(policy: NormalizedRetryPolicy, attempt: number, res?: Response): number {
    const retryAfter = res ? retryAfterDelayMs(res) : undefined;
    const delay = retryAfter ?? Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
    return policy.jitter ? Math.floor(Math.random() * delay) : delay;
}

function toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
}

async function discardBody(res: Response) {
    try {
        await res.body?.cancel();
    } catch {
        // Ignore body cleanup failures while retrying the original request.
    }
}

export abstract class ClientBase {

    _fetch: Promise<FETCH_FN>;
    baseUrl: string;
    errorFactory: (err: RequestError) => Error = (err) => err;
    verboseErrors = true;
    retryPolicy?: IRequestRetryPolicy;

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

    withRetryPolicy(policy?: IRequestRetryPolicy | null): this {
        this.retryPolicy = policy || undefined;
        return this;
    }

    getRetryPolicy(): IRequestRetryPolicy | undefined {
        return this.retryPolicy;
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

    handleFetchResponse(_req: Request, _res: Response): void {
    }

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
        return new ServerError(message, req, res.status, payload, this.verboseErrors);
    }


    async readJSONPayload(res: Response) {
        return res.text().then(text => {
            if (!text) {
                return undefined;
            } else {
                try {
                    return this.jsonParse(text);
                } catch (err: unknown) {
                    return {
                        status: res.status,
                        error: "Not a valid JSON payload",
                        message: err instanceof Error ? err.message : String(err),
                        text: text,
                    };
                }
            }
        }).catch((err: unknown) => {
            return {
                status: res.status,
                error: "Unable to load response content",
                message: err instanceof Error ? err.message : String(err),
            };
        });
    }

    /**
     * Subclasses You can override this to do something with the response
     * @param res
     */
    handleResponse<T = unknown>(req: Request, res: Response, params: IRequestParamsWithPayload | undefined): T | Promise<T> {
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
        let url = this.getUrl(path);
        if (params?.query) {
            url += `?${buildQueryString(params.query)}`;
        }
        const headers = this.headers ? Object.assign({}, this.headers) : {};
        const paramsHeaders = params?.headers;
        if (paramsHeaders) {
            for (const key in paramsHeaders) {
                headers[key.toLowerCase()] = paramsHeaders[key];
            }
        }
        let body: BodyInit | undefined;
        const payload = params?.payload;
        if (payload) {
            if (params && params.jsonPayload === false) {
                body = payload as BodyInit;
            } else {
                body = (typeof payload !== 'string') ? JSON.stringify(payload) : payload;
                if (!('content-type' in headers)) {
                    headers['content-type'] = 'application/json';
                }
            }
        }
        // When using SSE reader, ensure the Accept header requests event-stream
        if (params?.reader === 'sse') {
            headers['accept'] = 'text/event-stream';
        }

        const normalizedMethod = method.toUpperCase();
        const createRequestInit = (): RequestInit => {
            return {
                method: normalizedMethod,
                headers: Object.assign({}, headers),
                body: body,
            };
        }
        const retryPolicy = this.resolveRetryPolicy(params);
        const fetch = await this._fetch;

        if (!retryPolicy) {
            const req = await this.createRequest(url, createRequestInit());
            let res: Response;
            try {
                res = await fetch(req);
            } catch (err: unknown) {
                console.error(`Failed to connect to ${url}`, err);
                this.throwError(new ConnectionError(req, toError(err)));
            }
            this.handleFetchResponse(req, res);
            return this.handleResponse<T>(req, res, params);
        }

        const replayableBody = isReplayableBody(body);
        let lastReq: Request | undefined;
        for (let attempt = 0; attempt < retryPolicy.attempts; attempt++) {
            const req = await this.createRequest(url, createRequestInit());
            lastReq = req;
            let res: Response;
            try {
                res = await fetch(req);
            } catch (err: unknown) {
                if (!this.shouldRetryConnectionError(retryPolicy, normalizedMethod, attempt, replayableBody)) {
                    console.error(`Failed to connect to ${url}`, err);
                    this.throwError(new ConnectionError(req, toError(err)));
                }
                await this.waitBeforeRetry(retryPolicy, attempt);
                continue;
            }
            this.handleFetchResponse(req, res);
            if (this.shouldRetryResponse(retryPolicy, normalizedMethod, attempt, replayableBody, res)) {
                await discardBody(res);
                await this.waitBeforeRetry(retryPolicy, attempt, res);
                continue;
            }
            return this.handleResponse<T>(req, res, params);
        }

        if (lastReq) {
            this.throwError(new ConnectionError(lastReq, new Error(`Retry attempts exhausted for ${normalizedMethod} ${url}`)));
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
        return attempt < policy.attempts - 1
            && replayableBody
            && policy.methods.has(method)
            && policy.statuses.has(res.status);
    }

    private shouldRetryConnectionError(
        policy: NormalizedRetryPolicy,
        method: string,
        attempt: number,
        replayableBody: boolean,
    ) {
        return attempt < policy.attempts - 1
            && replayableBody
            && policy.retryOnConnectionError
            && policy.methods.has(method);
    }

    private waitBeforeRetry(policy: NormalizedRetryPolicy, attempt: number, res?: Response) {
        const delay = retryDelayMs(policy, attempt, res);
        return new Promise<void>(resolve => setTimeout(resolve, delay));
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
        const stream = await this.request(method, path, {
            ...params,
            reader: 'sse',
        }) as ReadableStream<ServerSentEvent>;

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
        return this._fetch.then(fetch => fetch(input, init));
    }

}
