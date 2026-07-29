import { act, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { type ScrollableSearchResult, useDefaultScrollableSearch } from './useScrollableSearch';

beforeAll(() => {
    // jsdom has no IntersectionObserver; the hook only needs it constructible.
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

/**
 * Regression tests for the infinite request loop: callers pass an INLINE search
 * closure (new identity every render). The fetch effect must not depend on that
 * identity, otherwise every completed request re-triggers the effect forever.
 */

type Item = { id: number };

function flush(): Promise<void> {
    // Drain the microtask queue so pending search promises settle.
    return act(() => Promise.resolve());
}

function Harness({
    searchFn,
    onApi,
}: {
    searchFn: (payload: unknown, offset: number, limit: number) => Promise<Item[]>;
    onApi: (api: ScrollableSearchResult<Item, unknown, number>) => void;
}) {
    const loadMoreRef = useRef<HTMLDivElement>(null);
    // Unrelated state to force extra re-renders, as a real page would.
    const [, setTick] = useState(0);
    const api = useDefaultScrollableSearch<Item, unknown>({
        // Inline closure ON PURPOSE — new identity on every render, like real callers.
        async search(payload, offset, limit) {
            return searchFn(payload, offset, limit);
        },
        pageSize: 2,
        nextPageTrigger: loadMoreRef,
        payload: {},
    });
    onApi(api);
    return (
        <div>
            <button type="button" data-testid="rerender" onClick={() => setTick((t) => t + 1)} />
            <div ref={loadMoreRef} />
        </div>
    );
}

function setup(searchFn: (payload: unknown, offset: number, limit: number) => Promise<Item[]>) {
    let api!: ScrollableSearchResult<Item, unknown, number>;
    const utils = render(
        <Harness
            searchFn={searchFn}
            onApi={(a) => {
                api = a;
            }}
        />,
    );
    return { ...utils, getApi: () => api };
}

describe('useDefaultScrollableSearch', () => {
    it('fetches exactly once on mount despite inline search closures and re-renders', async () => {
        const searchFn = vi.fn(async () => [{ id: 1 }, { id: 2 }]);
        const { getApi } = setup(searchFn);

        await flush();
        expect(searchFn).toHaveBeenCalledTimes(1);
        expect(getApi().result).toEqual([{ id: 1 }, { id: 2 }]);

        // Extra render cycles (state updates elsewhere on the page) must NOT re-fetch.
        await flush();
        await flush();
        expect(searchFn).toHaveBeenCalledTimes(1);
    });

    it('searchMore appends the next page (single extra request)', async () => {
        const pages: Item[][] = [[{ id: 1 }, { id: 2 }], [{ id: 3 }]];
        const searchFn = vi.fn(async (_p: unknown, offset: number) => pages[offset / 2] ?? []);
        const { getApi } = setup(searchFn);
        await flush();

        act(() => getApi().searchMore());
        await flush();

        expect(searchFn).toHaveBeenCalledTimes(2);
        expect(getApi().result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
        // Page of 1 < pageSize still probes once more only when triggered — no auto loop.
        await flush();
        expect(searchFn).toHaveBeenCalledTimes(2);
    });

    it('refresh() re-fetches even on the first page (same payload, same page)', async () => {
        const searchFn = vi.fn(async () => [{ id: 1 }]);
        const { getApi } = setup(searchFn);
        await flush();
        expect(searchFn).toHaveBeenCalledTimes(1);

        act(() => getApi().refresh());
        await flush();
        expect(searchFn).toHaveBeenCalledTimes(2);
    });

    it('empty result stops pagination (hasMore=false) and does not re-fetch', async () => {
        const searchFn = vi.fn(async () => []);
        const { getApi } = setup(searchFn);
        await flush();

        expect(searchFn).toHaveBeenCalledTimes(1);
        expect(getApi().hasMore).toBe(false);

        act(() => getApi().searchMore());
        await flush();
        // nextPage is null — searchMore is a no-op.
        expect(searchFn).toHaveBeenCalledTimes(1);
    });

    it('a failing search sets error once and does not retry in a loop', async () => {
        const searchFn = vi.fn(async () => {
            throw new Error('boom');
        });
        const { getApi } = setup(searchFn);
        await flush();
        await flush();

        expect(getApi().error?.message).toBe('boom');
        expect(searchFn).toHaveBeenCalledTimes(1);
    });
});
