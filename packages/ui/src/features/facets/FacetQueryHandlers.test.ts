import type {
    ComplexCollectionSearchQuery,
    ComplexSearchQuery,
    InteractionSearchQuery,
    PromptSearchQuery,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import type { AgentRunnerFilterQuery } from './AgentRunnerFacetsNav.js';
import { createAgentRunnerFilterHandler } from './AgentRunnerFacetsNav.js';
import { useCollectionsFilterHandler } from './CollectionsFacetsNav.js';
import { useDocumentFilterHandler } from './DocumentsFacetsNav.js';
import { useInteractionsFilterHandler } from './InteractionsFacetsNav.js';
import { usePromptsFilterHandler } from './PromptsFacetsNav.js';
import type { SearchInterface } from './utils/SearchInterface.js';

function createSearch<Query extends object>(): SearchInterface<Query> {
    return {
        query: {} as Query,
        isRunning: false,
        getFilterValue: vi.fn(),
        setFilterValue: vi.fn(),
        clearFilters: vi.fn(),
        search: vi.fn().mockResolvedValue(true),
        setDefaultKeys: vi.fn(),
    };
}

describe('facet query handlers', () => {
    it('only writes supported collection query keys', () => {
        const search = createSearch<ComplexCollectionSearchQuery>();
        useCollectionsFilterHandler(search)([
            { name: 'name', type: 'text', value: [{ value: 'Policies' }] },
            { name: 'unsupported', type: 'text', value: [{ value: 'ignored' }] },
        ]);
        expect(search.query).toEqual({ name: 'Policies' });
    });

    it('only writes supported prompt query keys', () => {
        const search = createSearch<PromptSearchQuery>();
        usePromptsFilterHandler(search)([
            { name: 'tags', type: 'stringList', multiple: true, value: ['reviewed'] },
            { name: 'unsupported', type: 'text', value: [{ value: 'ignored' }] },
        ]);
        expect(search.query).toEqual({ tags: ['reviewed'] });
    });

    it('only writes supported interaction query keys', () => {
        const search = createSearch<InteractionSearchQuery>();
        useInteractionsFilterHandler(search)([
            { name: 'model', type: 'text', value: [{ value: 'model-1' }] },
            { name: 'unsupported', type: 'text', value: [{ value: 'ignored' }] },
        ]);
        expect(search.query).toEqual({ model: 'model-1' });
    });

    it('nests document match filters instead of adding unsupported top-level properties', () => {
        const search = createSearch<ComplexSearchQuery>();
        useDocumentFilterHandler(search)([
            { name: 'tags', type: 'stringList', multiple: true, value: ['legal'] },
            {
                name: 'created_at',
                type: 'date',
                multiple: true,
                value: [{ value: '2026-01-01' }, { value: '2026-01-31' }],
            },
            { name: 'unsupported', type: 'text', value: [{ value: 'ignored' }] },
        ]);
        expect(search.query).toEqual({
            match: {
                tags: ['legal'],
                created_at: { gte: '2026-01-01', lte: '2026-01-31' },
            },
        });
    });

    it('only writes supported agent runner adapter keys', () => {
        const search = createSearch<AgentRunnerFilterQuery>();
        createAgentRunnerFilterHandler(search)([
            { name: 'initiated_by', type: 'text', value: [{ value: 'user-1' }] },
            { name: 'started_by', type: 'text', value: [{ value: 'ignored' }] },
        ]);
        expect(search.query).toEqual({ initiated_by: 'user-1' });
    });
});
