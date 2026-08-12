import { describe, expect, it } from 'vitest';
import { useRunsFilterGroups } from './RunsFacetsNav.js';

describe('useRunsFilterGroups', () => {
    it('builds controls from supported facets and keeps query-only filters', () => {
        const groups = useRunsFilterGroups({
            interactions: [
                { _id: null, count: 2 },
                { _id: 'interaction-1', count: 3, name: 'Interaction One' },
            ],
            finish_reason: [{ _id: null, count: 4 }],
        });

        expect(groups.map((group) => group.name)).toEqual([
            'run_ids',
            'interaction',
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
});
