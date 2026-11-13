type RuntimeProcess = {
    env?: Record<string, string | undefined>;
};

/** The path prefix of the data store API, which the data server answers as a whole. */
export const DATA_API_PATH = '/api/v1/data';

/** The DATA_SERVER_URL environment variable, in a runtime that has one. */
function getRuntimeDataServerUrl() {
    const runtimeProcess = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
    return runtimeProcess?.env?.DATA_SERVER_URL || undefined;
}

/**
 * The base URL of the data server, the service that answers the data store API (`/api/v1/data`), for a store base
 * URL. The data server serves the query calls itself and forwards every other data store call to zeno-server
 * unchanged, so the whole prefix goes to it.
 * - DATA_SERVER_URL, when the runtime sets it: a locally running data server, or the store URL itself to send the
 *   data store calls straight to zeno-server.
 * - A branch store on the GCP development domain (`zeno-server-<env>.api.dev1.vertesia.io`): the matching
 *   data-server host. Branch environments on other clouds deploy no data server and keep the store URL. An environment
 *   older than the data server has none either: the data store APIs notice it on their first call and go back to
 *   the store (see `DataServerTopic`).
 * - Any other store, localhost included: the store URL itself. A production domain's load balancer routes the prefix
 *   to the data server; a local stack keeps its own zeno-server.
 *
 * DataApi resolves it when the client is created, and the dashboards API each time `dashboards()` is called.
 */
export function dataServerBaseUrl(storeBaseUrl: string): string {
    const override = getRuntimeDataServerUrl();
    if (override) {
        return trimTrailingSlashes(override);
    }
    if (isDataServerBranchStore(storeBaseUrl)) {
        return storeBaseUrl.replace(/zeno-server/, 'data-server');
    }
    return storeBaseUrl;
}

/**
 * Whether a store URL is a branch environment that deploys a data server next to its zeno-server: a
 * `zeno-server-<env>` host on the GCP development domain. Branch environments on other clouds also name
 * `zeno-server` in their host but deploy no data server, so their data store calls must stay on the store.
 */
function isDataServerBranchStore(storeBaseUrl: string): boolean {
    try {
        const { hostname } = new URL(storeBaseUrl);
        return hostname.startsWith('zeno-server-') && hostname.endsWith(DATA_SERVER_BRANCH_DOMAIN);
    } catch {
        return false;
    }
}

/** The domain of the branch environments that deploy a data server. */
const DATA_SERVER_BRANCH_DOMAIN = '.api.dev1.vertesia.io';

/** The absolute base URL of the data store API for a store base URL: the data server's {@link DATA_API_PATH}. */
export function dataApiBaseUrl(storeBaseUrl: string): string {
    return `${trimTrailingSlashes(dataServerBaseUrl(storeBaseUrl))}${DATA_API_PATH}`;
}

/**
 * The data store API on the store itself, when {@link dataApiBaseUrl} sends the calls to a data server host it
 * derived from the store URL; undefined when they go to the store already, or to an explicit DATA_SERVER_URL. A
 * development environment older than the data server deploys none at the derived host: the data store APIs then
 * send their calls here (see `DataServerTopic`).
 */
export function dataApiStoreFallbackUrl(storeBaseUrl: string): string | undefined {
    if (getRuntimeDataServerUrl() || !isDataServerBranchStore(storeBaseUrl)) {
        return undefined;
    }
    return `${trimTrailingSlashes(storeBaseUrl)}${DATA_API_PATH}`;
}

/** A URL without its trailing slashes. A loop, not a regular expression: `/\/+$/` backtracks on a long run of slashes. */
function trimTrailingSlashes(url: string): string {
    let end = url.length;
    while (end > 0 && url.charCodeAt(end - 1) === 47) {
        end--;
    }
    return url.slice(0, end);
}
