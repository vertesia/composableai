import type { ZenoClient } from '@vertesia/client';
import type { ContentObjectItemApiResponse } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { DocumentSearch } from './DocumentSearchContext';

function createClient(searchImpl: () => Promise<unknown>): ZenoClient {
    return {
        objects: {
            search: vi.fn(searchImpl),
        },
    } as unknown as ZenoClient;
}

describe('DocumentSearch', () => {
    it('settles loading state and preserves current objects when search fails', async () => {
        const error = new Error('search failed');
        const currentObject = { id: 'object-1', name: 'Existing object' } as ContentObjectItemApiResponse;
        const search = new DocumentSearch(createClient(() => Promise.reject(error)));
        search.result.value = {
            objects: [currentObject],
            isLoading: false,
            hasMore: true,
        };

        await expect(search.search()).resolves.toBe(false);

        expect(search.initialized).toBe(true);
        expect(search.result.value).toMatchObject({
            error,
            isLoading: false,
            objects: [currentObject],
            hasMore: false,
        });
    });

    it('keeps deleted objects out of a refetch the index has not caught up with yet', async () => {
        // The index applies deletes out of band, so it still returns the deleted object here.
        const stale = [
            { id: 'gone', name: 'Deleted object' },
            { id: 'kept', name: 'Surviving object' },
        ] as ContentObjectItemApiResponse[];
        const search = new DocumentSearch(createClient(() => Promise.resolve({ results: stale })));
        search.result.value = { objects: stale, isLoading: false, hasMore: false };
        search.facets.value = { total: 2 };

        search.removeDeletedObjects(['gone']);

        // Gone from the list and the count straight away, without waiting for a refetch.
        expect(search.objects.map((obj) => obj.id)).toEqual(['kept']);
        expect(search.facets.value.total).toBe(1);

        // The refetch still returns it, and it must not come back.
        await expect(search.search()).resolves.toBe(true);
        expect(search.objects.map((obj) => obj.id)).toEqual(['kept']);
    });

    it('stops hiding a deleted object once the index no longer returns it', async () => {
        const remaining = [{ id: 'kept', name: 'Surviving object' }] as ContentObjectItemApiResponse[];
        const search = new DocumentSearch(createClient(() => Promise.resolve({ results: remaining })));
        search.removeDeletedObjects(['gone']);

        // The index has caught up: 'gone' is absent, so the entry is reconciled away.
        await expect(search.search()).resolves.toBe(true);
        expect(search.objects.map((obj) => obj.id)).toEqual(['kept']);
    });

    it('keeps hiding an object the index never stops returning', async () => {
        // Documents the current limitation deliberately: if the delete never reaches the index, the
        // row stays hidden for the life of this DocumentSearch instance. A reload builds a new one,
        // so it is not hidden permanently. Bounding this is a follow-up.
        const stuck = [{ id: 'gone', name: 'Delete never reached the index' }] as ContentObjectItemApiResponse[];
        const search = new DocumentSearch(createClient(() => Promise.resolve({ results: stuck })));
        search.removeDeletedObjects(['gone']);

        await search.search();
        await search.search();

        expect(search.objects).toEqual([]);
    });

    it('handles a missing index as an empty initialized search', async () => {
        const error = Object.assign(new Error('index missing'), { status: 404 });
        const search = new DocumentSearch(createClient(() => Promise.reject(error)));

        await expect(search.search()).resolves.toBe(false);

        expect(search.initialized).toBe(true);
        expect(search.result.value).toEqual({
            isLoading: false,
            objects: [],
            hasMore: false,
        });
    });
});
