import { ConnectionError, RequestError, ServerError } from "./errors.js";
import { sse, ServerSentEvent } from "./sse/index.js";
import { buildQueryString, join, removeTrailingSlash } from "./utils.js";

export type FETCH_FN = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
type IPrimitives = string | number | boolean | null | undefined | string[] | number[] | boolean[];

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

export abstract class ClientBase {

    _fetch: Promise<FETCH_FN>;
    baseUrl: string;
    errorFactory: (err: RequestError) => Error = (err) => err;
    verboseErrors = true;

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

    createServerError(req: Request, res: Response, payload: unknown): RequestError {
        const status = res.status;
        let message = 'Server Error: ' + status;
        if (payload) {
            if (isInvalidJsonPayload(payload)) {
                message += res.statusText ? ' ' + res.statusText : '';
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
        if (params && params.reader) {
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
            url += '?' + buildQueryString(params.query);
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
        if (params?.reader === 'sse' && !('accept' in headers)) {
            headers['accept'] = 'text/event-stream';
        }

        const init: RequestInit = {
            method: method,
            headers: headers,
            body: body,
        }
        const req = await this.createRequest(url, init);
        return this._fetch.then(fetch => fetch(req).catch(err => {
            console.error(`Failed to connect to ${url}`, err);
            this.throwError(new ConnectionError(req, err));
        }).then(res => {
            return this.handleResponse<T>(req, res, params);
        }));
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
