import { describe, expect, it } from 'vitest';
import { type AgentResourceReference, getResourcesFromToolResult, normalizeAgentResources } from './interaction.js';
import { AgentMessageType, getResourcesFromMessage } from './store/workflow.js';

const validRef: AgentResourceReference = {
    type: 'document',
    id: 'doc-1',
    label: 'My Document',
    action: 'created',
};

describe('normalizeAgentResources', () => {
    it('returns an empty array for non-array input', () => {
        expect(normalizeAgentResources(undefined)).toEqual([]);
        expect(normalizeAgentResources(null)).toEqual([]);
        expect(normalizeAgentResources('nope')).toEqual([]);
        expect(normalizeAgentResources({})).toEqual([]);
    });

    it('keeps a well-formed reference', () => {
        expect(normalizeAgentResources([validRef])).toEqual([validRef]);
    });

    it('preserves revision_id when present and non-empty', () => {
        const ref = { ...validRef, revision_id: 'rev-9' };
        expect(normalizeAgentResources([ref])).toEqual([ref]);
    });

    it('drops an empty revision_id rather than keeping it', () => {
        const result = normalizeAgentResources([{ ...validRef, revision_id: '' }]);
        expect(result[0]).not.toHaveProperty('revision_id');
    });

    it('falls back to the id when the label is missing or empty', () => {
        const result = normalizeAgentResources([{ type: 'collection', id: 'col-1', action: 'updated' }]);
        expect(result).toEqual([{ type: 'collection', id: 'col-1', label: 'col-1', action: 'updated' }]);
    });

    it('drops entries with an unknown type or action', () => {
        const result = normalizeAgentResources([
            { type: 'artifact', id: 'a', label: 'a', action: 'created' },
            { type: 'document', id: 'd', label: 'd', action: 'viewed' },
            { type: 'document', id: '', label: 'd', action: 'created' },
            validRef,
        ]);
        expect(result).toEqual([validRef]);
    });

    it('accepts every supported resource type', () => {
        const types = [
            'document',
            'collection',
            'content_type',
            'interaction',
            'prompt',
            'agent',
            'workflow',
            'process',
            'process_run',
            'interaction_run',
            'view',
        ] as const;
        const input = types.map((type, i) => ({ type, id: `id-${i}`, label: `L${i}`, action: 'created' }));
        expect(normalizeAgentResources(input)).toHaveLength(types.length);
    });
});

describe('getResourcesFromToolResult', () => {
    it('reads resources from result meta', () => {
        expect(getResourcesFromToolResult({ meta: { resources: [validRef] } })).toEqual([validRef]);
    });

    it('returns an empty array when meta or resources are absent', () => {
        expect(getResourcesFromToolResult({})).toEqual([]);
        expect(getResourcesFromToolResult({ meta: {} })).toEqual([]);
    });
});

describe('getResourcesFromMessage', () => {
    it('reads resources from message details', () => {
        const msg = {
            timestamp: 0,
            workflow_run_id: 'run-1',
            type: AgentMessageType.THOUGHT,
            message: '',
            details: { event_class: 'activity', resources: [validRef] },
        };
        expect(getResourcesFromMessage(msg)).toEqual([validRef]);
    });

    it('returns an empty array when details or resources are absent', () => {
        const msg = {
            timestamp: 0,
            workflow_run_id: 'run-1',
            type: AgentMessageType.COMPLETE,
            message: '',
        };
        expect(getResourcesFromMessage(msg)).toEqual([]);
    });
});
