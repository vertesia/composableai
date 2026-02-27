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
        let message = 'Server Error: ' + status;
        if (payload) {
            if (payload.message) {
                message = String(payload.message);
            } else if (payload.error) {
                if (typeof payload.error === 'string') {
                    message = String(payload.error);
                } else if (typeof payload.error.message === 'string') {
                    message = String(payload.error.message);
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
        if (params && params.reader) {
            if (params.reader === 'sse') {
                return sse(res);
            } else {
                return params.reader.call(this, res);
            }
        } else {
            return this.readJSONPayload(res).then((payload) => {
                if (res.ok) {
                    return payload;
                } else {
                    this.throwError(this.createServerError(req, res, payload));
                }
            });
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
