import { ConnectionError, RequestError, ServerError } from "./errors.js";
import { sse } from "./sse/index.js";
import { buildQueryString, join, removeTrailingSlash } from "./utils.js";

export type FETCH_FN = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
type IPrimitives = string | number | boolean | null | undefined | string[] | number[] | boolean[];

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
    reader?: 'sse' | ((response: Response) => any);
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

    getUrl(path: string) {
        return removeTrailingSlash(join(this.baseUrl, path));
    }

    get(path: string, params?: IRequestParams) {
        return this.request('GET', path, params);
    }

    del(path: string, params?: IRequestParams) {
        return this.request('DELETE', path, params);
    }

    delete(path: string, params?: IRequestParams) {
        return this.request('DELETE', path, params);
    }

    post(path: string, params?: IRequestParamsWithPayload) {
        return this.request('POST', path, params);
    }

    put(path: string, params?: IRequestParamsWithPayload) {
        return this.request('PUT', path, params);
    }

    /**
     * You can customize the json parser by overriding this method
     * @param text
     * @returns
     */
    jsonParse(text: string) {
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

    createServerError(req: Request, res: Response, payload: any): RequestError {
        const status = res.status;
        let message: string;
        let upstreamMessage: string | undefined;

        // Extract upstream message from payload if available
        if (payload && typeof payload === 'object') {
            if (payload.message && typeof payload.message === 'string' && !payload.message.includes('Not a valid JSON')) {
                upstreamMessage = payload.message;
            } else if (payload.error) {
                if (typeof payload.error === 'string' && !payload.error.includes('Not a valid JSON')) {
                    upstreamMessage = payload.error;
                } else if (typeof payload.error?.message === 'string') {
                    upstreamMessage = payload.error.message;
                }
            } else if (payload.text && typeof payload.text === 'string' && payload.text.length > 0) {
                // Include raw text for non-JSON responses (limit length)
                upstreamMessage = payload.text.substring(0, 200);
            }
        }

        // Create status-based primary message
        switch (status) {
            case 429:
                message = 'Rate limit exceeded - inference service is busy';
                break;
            case 502:
                message = 'Bad gateway - upstream service error';
                break;
            case 503:
                message = 'Service unavailable';
                break;
            case 504:
                message = 'Gateway timeout - request took too long';
                break;
            case 529:
                message = 'Site overloaded - service temporarily unavailable';
                break;
            case 500:
                message = 'Internal server error';
                break;
            default:
                message = `Server error: ${status}`;
        }

        // Append upstream message if available and meaningful
        if (upstreamMessage) {
            message += ` (${upstreamMessage})`;
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
                } catch (err: any) {
                    return {
                        status: res.status,
                        error: "Not a valid JSON payload",
                        message: err.message,
                        text: text,
                    };
                }
            }
        }).catch((err) => {
            return {
                status: res.status,
                error: "Unable to load response content",
                message: err.message,
            };
        });
    }

    /**
     * Subclasses You can override this to do something with the response
     * @param res
     */
    handleResponse(req: Request, res: Response, params: IRequestParamsWithPayload | undefined) {
        res.url
        if (params && params.reader) {
            if (params.reader === 'sse') {
                return sse(res);
            } else {
                return params.reader.call(this, res);
            }
        } else {
            // Check HTTP status BEFORE attempting JSON parsing
            if (!res.ok) {
                // For error responses, attempt to read payload but handle parsing failures gracefully
                return this.readJSONPayload(res).then((payload) => {
                    this.throwError(this.createServerError(req, res, payload));
                });
            }
            // For successful responses, read and return JSON
            return this.readJSONPayload(res);
        }
    }

    async request(method: string, path: string, params?: IRequestParamsWithPayload) {
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
            return this.handleResponse(req, res, params);
        }));
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
