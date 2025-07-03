import { ClientBase, FETCH_FN, IRequestParamsWithPayload } from "./base.js";
import { RequestError } from "./errors.js";

function isAuthorizationHeaderSet(headers: HeadersInit | undefined): boolean {
    if (!headers) return false;
    return "authorization" in headers;
}

export class AbstractFetchClient<T extends AbstractFetchClient<T>> extends ClientBase {

    headers: Record<string, string>;
    _auth?: () => Promise<string>;
    // callbacks useful to log requests and responses
    onRequest?: (req: Request) => void;
    onResponse?: (res: Response, req: Request) => void;
    // the last response. Can be used to inspect the response headers
    response?: Response;

    constructor(baseUrl: string, fetchImpl?: FETCH_FN | Promise<FETCH_FN>) {
        super(baseUrl, fetchImpl);
        this.baseUrl = baseUrl[baseUrl.length - 1] === '/' ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
        this.headers = this.initialHeaders;
    }

    get initialHeaders() {
        return { accept: 'application/json' };
    }

    /**
     * Install an auth callback. If the callback is undefined or null then remove the auth callback.
     * @param authCb a function returning a promise that resolves to the value to use for the authorization header
     * @returns the client instance
     */
    withAuthCallback(authCb?: (() => Promise<string>) | null) {
        this._auth = authCb || undefined;
        return this;
    }

    withErrorFactory(factory: (err: RequestError) => Error) {
        this.errorFactory = factory;
        return this as unknown as T;
    }

    withLang(locale: string | undefined | null) {
        if (locale) {
            this.headers['accept-language'] = locale;
        } else {
            delete this.headers['accept-language'];
        }
        return this as unknown as T;
    }

    withHeaders(headers: Record<string, string>) {
        const thisHeaders = this.headers;
        for (const key in headers) {
            const value = headers[key];
            if (value != null) {
                thisHeaders[key.toLowerCase()] = value;
            }
        }
        return this as unknown as T;
    }

    setHeader(key: string, value: string | undefined) {
        if (!value) {
            delete this.headers[key.toLowerCase()];
        } else {
            this.headers[key.toLowerCase()] = value;
        }
    }

    async createRequest(url: string, init: RequestInit) {
        if (this._auth && !isAuthorizationHeaderSet(init.headers)) {
            const headers = (init.headers ? init.headers : {}) as Record<string, string>;
            init.headers = headers;
            const auth = await this._auth();
            if (auth) {
                init.headers["authorization"] = auth;
            }
        }
        this.response = undefined;
        const request = await super.createRequest(url, init);
        this.onRequest && this.onRequest(request);
        return request;
    }

    async handleResponse(req: Request, res: Response, params: IRequestParamsWithPayload | undefined): Promise<any> {
        this.response = res; // store last response
        this.onResponse && this.onResponse(res, req);
        return super.handleResponse(req, res, params);
    }

}

export class FetchClient extends AbstractFetchClient<FetchClient> {

    constructor(baseUrl: string, fetchImpl?: FETCH_FN | Promise<FETCH_FN>) {
        super(baseUrl, fetchImpl);
    }

}

export abstract class ApiTopic extends ClientBase {

    constructor(public client: ClientBase, basePath: string) {
        //TODO we should refactor the way ClientBase and ApiTopic is created
        // to avoid cloning all customizations
        super(client.getUrl(basePath), client._fetch);
        this.createServerError = client.createServerError
        this.errorFactory = client.errorFactory;
        this.verboseErrors = client.verboseErrors;
    }

    createRequest(url: string, init: RequestInit): Promise<Request> {
        return this.client.createRequest(url, init);
    }

    handleResponse(req: Request, res: Response, params: IRequestParamsWithPayload | undefined): Promise<any> {
        return this.client.handleResponse(req, res, params);
    }

    get headers() {
        return this.client.headers;
    }

}
