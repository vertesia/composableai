import { describe, expect, test } from 'vitest';
import { useRunsFilterGroups } from './RunsFacetsNav';

describe('useRunsFilterGroups', () => {
    test('handles null facet identifiers from the run facets API', () => {
        const groups = useRunsFilterGroups({
            models: [
                { _id: null, count: 2 },
                { _id: 'model-1', count: 3 },
            ],
            finish_reason: [{ _id: null, count: 4 }],
            created_by: [{ _id: null, count: 5 }],
        });

        expect(groups.find((group) => group.name === 'model')?.options).toEqual([
            { label: 'model-1 (3)', value: 'model-1' },
        ]);
        expect(groups.find((group) => group.name === 'finish_reason')?.options).toEqual([
            { label: 'none (4)', value: 'none' },
        ]);
        expect(groups.find((group) => group.name === 'created_by')?.options).toEqual([
            { label: '(5)', value: 'Unknown User' },
        ]);
    });
});
