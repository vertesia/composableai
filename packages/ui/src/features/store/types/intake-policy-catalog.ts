import type { VertesiaClient } from '@vertesia/client';

type CatalogSources = Pick<
    VertesiaClient['interactions']['catalog'],
    'listStoredInteractions' | 'listSysInteractions' | 'listAllAppInteractions'
>;

/** The combined catalog route is intentionally unimplemented; retain each available source. */
export async function loadIntakeInteractions(catalog: CatalogSources) {
    const sources = await Promise.allSettled([
        catalog.listStoredInteractions(),
        catalog.listSysInteractions(),
        catalog.listAllAppInteractions(),
    ]);
    return {
        items: sources.flatMap((source) => (source.status === 'fulfilled' ? source.value : [])),
        failed: sources.some((source) => source.status === 'rejected'),
    };
}
