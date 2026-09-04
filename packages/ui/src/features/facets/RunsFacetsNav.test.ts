import type { RunSearchQuery } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { useRunsFilterGroups, useRunsFilterHandler } from './RunsFacetsNav.js';
import type { SearchInterface } from './utils/SearchInterface.js';

function createSearch(): SearchInterface<RunSearchQuery> {
    return {
        query: {},
        isRunning: false,
        getFilterValue: vi.fn(),
        setFilterValue: vi.fn(),
        clearFilters: vi.fn(),
        search: vi.fn().mockResolvedValue(true),
        setDefaultKeys: vi.fn(),
    };
}

describe('useRunsFilterGroups', () => {
    it('builds controls from supported facets and keeps query-only filters', () => {
        const groups = useRunsFilterGroups({
            interactions: [
                { _id: null, count: 2 },
                { _id: 'interaction-1', count: 3, name: 'Interaction One' },
            ],
            finish_reason: [{ _id: null, count: 4 }],
            environments: [{ _id: 'production', count: 5 }],
        });

        expect(groups.map((group) => group.name)).toEqual([
            'run_ids',
            'interaction',
            'environment',
            'tags',
            'finish_reason',
            'start',
            'end',
            'workflow_run_ids',
            'workflow_ids',
        ]);
        expect(groups.find((group) => group.name === 'interaction')?.options).toEqual([
            { label: '(3)', value: 'interaction-1' },
        ]);
        expect(groups.find((group) => group.name === 'finish_reason')?.options).toEqual([
            { label: 'none (4)', value: 'none' },
        ]);
    });

    it('uses the singular API environment key and ignores unsupported names', () => {
        const search = createSearch();

        useRunsFilterHandler(search)([
            { name: 'environment', type: 'text', value: [{ value: 'production' }] },
            { name: 'environments', type: 'text', value: [{ value: 'ignored' }] },
        ]);

        expect(search.query).toEqual({ environment: 'production' });
        expect(search.search).toHaveBeenCalledOnce();
    });
});
