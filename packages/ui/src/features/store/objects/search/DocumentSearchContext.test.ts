import type { ZenoClient } from '@vertesia/client';
import type { ContentObjectItem } from '@vertesia/common';
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
        const currentObject = { id: 'object-1', name: 'Existing object' } as ContentObjectItem;
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
