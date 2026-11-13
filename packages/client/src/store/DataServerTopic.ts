import { ApiTopic, type ClientBase, type IRequestParamsWithPayload } from '@vertesia/api-fetch-client';
import { dataApiBaseUrl, dataApiStoreFallbackUrl } from './data-server.js';

/** The clients whose derived data server host answered that nothing is deployed there. */
const clientsWithoutDataServer = new WeakSet<ClientBase>();

/** Thrown by {@link DataServerTopic.handleResponse} and caught by {@link DataServerTopic.request}; never reaches a caller. */
class MissingDataServerError extends Error {
    constructor() {
        super('No data server is deployed at the derived host');
        this.name = 'MissingDataServerError';
    }
}

/**
 * Whether a response says that no service is deployed at the host: the 404 of the platform's front end, which has
 * no body. A 404 of the data server or of zeno-server (an unknown store, for example) is JSON, and the ones the data
 * server answers itself also name it in `x-service-name`.
 */
export function isMissingDataServerResponse(res: Response): boolean {
    return res.status === 404 && !res.headers.get('content-type') && !res.headers.get('x-service-name');
}

/**
 * Base of the data store APIs, whose calls go to the data server (see `dataServerBaseUrl`).
 *
 * When the data server host was derived from the store URL and nothing is deployed there (a development
 * environment older than the data server), the call is sent again to the store, which serves the whole data store
 * API itself, and every later call of the same client goes straight there. Nothing is retried when the address
 * comes from DATA_SERVER_URL, or when the calls already go to the store.
 */
export abstract class DataServerTopic extends ApiTopic {
    /** The data store API on the store, while the calls go to a derived data server host that has not answered yet. */
    private storeFallbackUrl?: string;
    private readonly parent: ClientBase;

    /**
     * @param parent the store client
     * @param path the path of this API below the data store API, with its leading slash
     */
    constructor(parent: ClientBase, path = '') {
        const fallback = dataApiStoreFallbackUrl(parent.baseUrl);
        const useStore = fallback !== undefined && clientsWithoutDataServer.has(parent);
        super(parent, `${useStore ? fallback : dataApiBaseUrl(parent.baseUrl)}${path}`);
        this.parent = parent;
        if (fallback !== undefined && !useStore) {
            this.storeFallbackUrl = `${fallback}${path}`;
        }
    }

    override async request<T = unknown>(method: string, path: string, params?: IRequestParamsWithPayload): Promise<T> {
        try {
            return await super.request<T>(method, path, params);
        } catch (err: unknown) {
            if (!(err instanceof MissingDataServerError)) {
                throw err;
            }
            this.switchToStore();
            return super.request<T>(method, path, params);
        }
    }

    override handleResponse<T = unknown>(
        req: Request,
        res: Response,
        params: IRequestParamsWithPayload | undefined,
    ): T | Promise<T> {
        // A stream body was consumed by this attempt and cannot be sent again: let the 404 through.
        if (this.storeFallbackUrl && isMissingDataServerResponse(res) && !isStream(params?.payload)) {
            throw new MissingDataServerError();
        }
        return super.handleResponse<T>(req, res, params);
    }

    /** Sends the calls of this API, and of the APIs the client creates from now on, to the store. */
    private switchToStore(): void {
        const storeUrl = this.storeFallbackUrl;
        if (!storeUrl) {
            // A concurrent call already switched.
            return;
        }
        if (!clientsWithoutDataServer.has(this.parent)) {
            clientsWithoutDataServer.add(this.parent);
            console.warn(
                `No data server is deployed at ${new URL(this.baseUrl).host}; ` +
                    `sending the data store calls to ${new URL(storeUrl).host} instead`,
            );
        }
        this.baseUrl = storeUrl;
        this.storeFallbackUrl = undefined;
    }
}

function isStream(payload: unknown): boolean {
    return typeof ReadableStream !== 'undefined' && payload instanceof ReadableStream;
}
