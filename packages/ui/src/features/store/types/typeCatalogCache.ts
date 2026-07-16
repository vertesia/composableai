import type { VertesiaClient } from '@vertesia/client';
import type { ContentObjectTypeItem } from '@vertesia/common';

/**
 * Browser-session cache for content-type catalog lookups, so render-time consumers
 * (e.g. the document view resolving a type's `default_view`) don't pay a catalog request
 * per document view.
 *
 * Scoped per VertesiaClient instance (WeakMap), so switching project/session naturally
 * starts a fresh cache. Entries are cached promises to dedupe concurrent lookups; failed
 * lookups self-evict so the next view retries. In-app type edits must call
 * `invalidateTypeCache` — edits made elsewhere (assistant, another tab) are picked up on
 * the next session.
 */
const cachePerClient = new WeakMap<VertesiaClient, Map<string, Promise<ContentObjectTypeItem | undefined>>>();

export function resolveTypeCached(client: VertesiaClient, typeId: string): Promise<ContentObjectTypeItem | undefined> {
    let cache = cachePerClient.get(client);
    if (!cache) {
        cache = new Map();
        cachePerClient.set(client, cache);
    }
    let entry = cache.get(typeId);
    if (!entry) {
        entry = client.types.catalog.resolve(typeId).then(
            (type) => type ?? undefined,
            () => {
                cachePerClient.get(client)?.delete(typeId);
                return undefined;
            },
        );
        cache.set(typeId, entry);
    }
    return entry;
}

export function invalidateTypeCache(client: VertesiaClient, typeId?: string): void {
    const cache = cachePerClient.get(client);
    if (!cache) return;
    if (typeId) {
        cache.delete(typeId);
    } else {
        cache.clear();
    }
}
