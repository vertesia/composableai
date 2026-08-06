import { type AgentMessage, AgentMessageType, type AgentResourceReference } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    aggregateLatestTurnResources,
    interleaveTurnSummaries,
    isResourceSummaryReady,
    segmentTurnResources,
} from './resourceSummary';

let seq = 0;
function msg(type: AgentMessageType, resources?: AgentResourceReference[], workstream_id = 'main'): AgentMessage {
    seq += 1;
    return {
        timestamp: seq,
        workflow_run_id: 'run-1',
        type,
        message: '',
        workstream_id,
        ...(resources ? { details: { event_class: 'activity', resources } } : {}),
    };
}

function ref(
    type: AgentResourceReference['type'],
    id: string,
    action: AgentResourceReference['action'],
    label = id,
): AgentResourceReference {
    return { type, id, label, action };
}

describe('aggregateLatestTurnResources', () => {
    it('returns resources from tool messages in the latest turn', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('document', 'd1', 'created', 'Doc One')]),
            msg(AgentMessageType.THOUGHT, [ref('collection', 'c1', 'created', 'Col One')]),
            msg(AgentMessageType.COMPLETE),
        ]);
        expect(result).toEqual([
            ref('document', 'd1', 'created', 'Doc One'),
            ref('collection', 'c1', 'created', 'Col One'),
        ]);
    });

    it('ignores resources from earlier turns', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('document', 'old', 'created')]),
            msg(AgentMessageType.COMPLETE),
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('document', 'new', 'created')]),
            msg(AgentMessageType.COMPLETE),
        ]);
        expect(result).toEqual([ref('document', 'new', 'created')]);
    });

    it('dedupes by (type, id) and lets create win over later updates', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('document', 'd1', 'created', 'First')]),
            msg(AgentMessageType.THOUGHT, [ref('document', 'd1', 'updated', 'Renamed')]),
        ]);
        // create wins, but the most recent label is retained
        expect(result).toEqual([ref('document', 'd1', 'created', 'Renamed')]);
    });

    it('drops a resource created then deleted in the same turn', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('document', 'scratch', 'created')]),
            msg(AgentMessageType.THOUGHT, [ref('document', 'scratch', 'deleted')]),
        ]);
        expect(result).toEqual([]);
    });

    it('keeps a resource deleted then re-created in the same turn (order matters)', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('view', 'v1', 'deleted')]),
            msg(AgentMessageType.THOUGHT, [ref('view', 'v1', 'created', 'Rebuilt View')]),
        ]);
        expect(result).toEqual([ref('view', 'v1', 'created', 'Rebuilt View')]);
    });

    it('reports a pre-existing resource deleted → recreated → deleted as deleted (not transient)', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('view', 'v1', 'deleted')]),
            msg(AgentMessageType.THOUGHT, [ref('view', 'v1', 'created')]),
            msg(AgentMessageType.THOUGHT, [ref('view', 'v1', 'deleted', 'Old View')]),
        ]);
        expect(result).toEqual([ref('view', 'v1', 'deleted', 'Old View')]);
    });

    it('omits a resource created → deleted → created → deleted (never existed before the turn)', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('view', 'v1', 'created')]),
            msg(AgentMessageType.THOUGHT, [ref('view', 'v1', 'deleted')]),
            msg(AgentMessageType.THOUGHT, [ref('view', 'v1', 'created')]),
            msg(AgentMessageType.THOUGHT, [ref('view', 'v1', 'deleted')]),
        ]);
        expect(result).toEqual([]);
    });

    it('keeps a delete of a pre-existing resource', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('interaction', 'i1', 'deleted', 'Old Interaction')]),
        ]);
        expect(result).toEqual([ref('interaction', 'i1', 'deleted', 'Old Interaction')]);
    });

    it('collapses repeated updates into a single entry', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('collection', 'c1', 'updated')]),
            msg(AgentMessageType.THOUGHT, [ref('collection', 'c1', 'updated')]),
        ]);
        expect(result).toEqual([ref('collection', 'c1', 'updated')]);
    });

    it('aggregates resources across child workstreams in the turn', () => {
        const result = aggregateLatestTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('document', 'main-doc', 'created')], 'main'),
            msg(AgentMessageType.THOUGHT, [ref('document', 'child-doc', 'created')], 'ws-2'),
        ]);
        expect(result).toEqual([ref('document', 'main-doc', 'created'), ref('document', 'child-doc', 'created')]);
    });
});

describe('segmentTurnResources', () => {
    it('returns one entry per turn with that turn’s resources', () => {
        const turns = segmentTurnResources([
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('document', 'd1', 'created')]),
            msg(AgentMessageType.COMPLETE),
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('collection', 'c1', 'created')]),
            msg(AgentMessageType.COMPLETE),
        ]);
        expect(turns).toEqual([[ref('document', 'd1', 'created')], [ref('collection', 'c1', 'created')]]);
    });

    it('folds leading non-question messages into the first turn (index alignment)', () => {
        const turns = segmentTurnResources([
            msg(AgentMessageType.SYSTEM),
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('document', 'd1', 'created')]),
            msg(AgentMessageType.QUESTION),
            msg(AgentMessageType.THOUGHT, [ref('document', 'd2', 'created')]),
        ]);
        expect(turns).toHaveLength(2);
        expect(turns[0]).toEqual([ref('document', 'd1', 'created')]);
        expect(turns[1]).toEqual([ref('document', 'd2', 'created')]);
    });
});

describe('isResourceSummaryReady', () => {
    it('treats a final answer as the end of an interactive turn', () => {
        expect(
            isResourceSummaryReady([
                msg(AgentMessageType.QUESTION),
                msg(AgentMessageType.THOUGHT, [ref('document', 'd1', 'created')]),
                msg(AgentMessageType.ANSWER),
            ]),
        ).toBe(true);
    });

    it('does not treat an answer as final when later main-workstream activity exists', () => {
        expect(
            isResourceSummaryReady([
                msg(AgentMessageType.QUESTION),
                msg(AgentMessageType.ANSWER),
                msg(AgentMessageType.THOUGHT),
            ]),
        ).toBe(false);
    });

    it('does not let a child-workstream answer complete the main turn', () => {
        expect(
            isResourceSummaryReady([
                msg(AgentMessageType.QUESTION),
                msg(AgentMessageType.THOUGHT),
                msg(AgentMessageType.ANSWER, undefined, 'child'),
            ]),
        ).toBe(false);
    });
});

describe('interleaveTurnSummaries', () => {
    type Item = { kind: 'q' | 'x'; id: string };
    const q = (id: string): Item => ({ kind: 'q', id });
    const x = (id: string): Item => ({ kind: 'x', id });
    const isBoundary = (i: Item) => i.kind === 'q';
    const turn = (id: string, action: AgentResourceReference['action'] = 'created'): AgentResourceReference[] => [
        ref('document', id, action),
    ];

    it('inserts a completed turn’s summary before the next turn boundary and at the end', () => {
        const items = [q('q1'), x('a'), q('q2'), x('b')];
        const out = interleaveTurnSummaries(items, isBoundary, [turn('d1'), turn('d2')], true);
        const kinds = out.map((i) => ('type' in i ? i.type : i.kind));
        // summary for turn 0 appears before q2; summary for turn 1 at the end
        expect(kinds).toEqual(['q', 'x', 'resource_summary', 'q', 'x', 'resource_summary']);
    });

    it('does not render the last (in-progress) turn summary until the stream is complete', () => {
        const items = [q('q1'), x('a')];
        const out = interleaveTurnSummaries(items, isBoundary, [turn('d1')], false);
        expect(out.some((i) => 'type' in i && i.type === 'resource_summary')).toBe(false);
    });

    it('skips turns with no resources', () => {
        const items = [q('q1'), x('a'), q('q2')];
        const empty: AgentResourceReference[] = [];
        const out = interleaveTurnSummaries(items, isBoundary, [empty, turn('d2')], true);
        // turn 0 empty → no summary before q2; turn 1 has resources → summary at end
        const kinds = out.map((i) => ('type' in i ? i.type : i.kind));
        expect(kinds).toEqual(['q', 'x', 'q', 'resource_summary']);
    });

    it('returns items unchanged when there are no turn summaries', () => {
        const items = [q('q1'), x('a')];
        expect(interleaveTurnSummaries(items, isBoundary, [], true)).toBe(items);
    });
});
