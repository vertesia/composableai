type RuntimeProcess = {
    env?: Record<string, string | undefined>;
};

/** The ZENO_BULK_URL environment variable, in a runtime that has one. */
function getRuntimeZenoBulkUrl() {
    const runtimeProcess = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
    return runtimeProcess?.env?.ZENO_BULK_URL || undefined;
}

/**
 * The base URL of zeno-bulk, the service behind the bulk export and reindex endpoints, for a store base URL.
 * - ZENO_BULK_URL, when the runtime sets it: a local stack that runs its own zeno-bulk, or none, points it there.
 * - A store on localhost: the dev1 zeno-bulk, which serves the database a default local stack uses.
 * - A dev-branch store, whose host names zeno-server: the matching zeno-bulk host.
 * - Any other store: its own domain, whose load balancer routes the bulk paths to zeno-bulk.
 */
export function zenoBulkBaseUrl(storeBaseUrl: string): string {
    const override = getRuntimeZenoBulkUrl();
    if (override) {
        return override.replace(/\/+$/, '');
    }
    if (storeBaseUrl.includes('localhost:') || storeBaseUrl.includes('127.0.0.1:')) {
        return 'https://zeno-bulk-dev-main.api.dev1.vertesia.io';
    }
    if (storeBaseUrl.includes('zeno-server')) {
        return storeBaseUrl.replace(/zeno-server/, 'zeno-bulk');
    }
    return storeBaseUrl;
}
