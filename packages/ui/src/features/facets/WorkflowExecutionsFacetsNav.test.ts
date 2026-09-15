import type { ListWorkflowRunsPayload } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import type { SearchInterface } from './utils/SearchInterface.js';
import {
    useWorkflowExecutionsFilterGroups,
    useWorkflowExecutionsFilterHandler,
} from './WorkflowExecutionsFacetsNav.js';

function createSearch(): SearchInterface<ListWorkflowRunsPayload> {
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

describe('useWorkflowExecutionsFilterHandler', () => {
    it('uses API payload keys for every filter group', () => {
        expect(
            useWorkflowExecutionsFilterGroups({
                status: [{ _id: 'running', count: 1 }],
                initiated_by: [{ _id: 'user-1', count: 1 }],
            }).map((group) => group.name),
        ).toEqual(['search_term', 'status', 'initiated_by', 'start', 'end', 'has_reported_errors']);
    });

    it('maps the workflow name or run ID filter directly to search_term', () => {
        const search = createSearch();
        const handleFilters = useWorkflowExecutionsFilterHandler(search);

        handleFilters([
            {
                name: 'search_term',
                type: 'text',
                value: [{ value: 'workflow-or-run-id' }],
            },
        ]);

        expect(search.query).toEqual({ search_term: 'workflow-or-run-id' });
        expect(search.clearFilters).toHaveBeenCalledWith(false);
        expect(search.search).toHaveBeenCalledOnce();
    });

    it('does not copy unknown filter names into the API payload', () => {
        const search = createSearch();
        const handleFilters = useWorkflowExecutionsFilterHandler(search);

        handleFilters([{ name: 'unsupported', type: 'text', value: [{ value: 'value' }] }]);

        expect(search.query).toEqual({});
        expect(search.search).toHaveBeenCalledOnce();
    });
});
