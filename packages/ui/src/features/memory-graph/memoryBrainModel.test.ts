// @vitest-environment node
import { type ContentObjectItemApiResponse, ContentObjectStatus, type JSONObject } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    buildMemoryBrainFilter,
    formatModelName,
    type MemoryBrain,
    memoryBrainStatusTone,
    parseMemoryBrains,
    selectMemoryBrain,
    sortMemoryBrains,
} from './memoryBrainModel.js';

function brainStub(brainId: string, displayName: string, status: MemoryBrain['status']): MemoryBrain {
    return { brainId, displayName, status, model: 'provider/model' };
}

function contentRecord(id: string, name: string, properties: JSONObject): ContentObjectItemApiResponse {
    return {
        id,
        name,
        created_by: 'user-1',
        updated_by: 'user-1',
        created_at: '2026-08-29T00:00:00.000Z',
        updated_at: '2026-08-29T00:00:00.000Z',
        location: '/',
        status: ContentObjectStatus.completed,
        revision: { root: id, head: true },
        properties,
    };
}

describe('Memory brains', () => {
    const sol = contentRecord('brain-record-sol', 'Sol reconstruction', {
        brain_id: 'sol-high',
        display_name: 'Sol High',
        model: 'openai/gpt-5.6-sol',
        reasoning_effort: 'high',
        status: 'active',
        last_run_id: 'sol-run-1',
        generation: 7,
        partition_field: 'properties.published_at',
        partition_interval: 'week',
        partition_order: 'ascending',
    });
    const opus = contentRecord('brain-record-opus', 'Opus reconstruction', {
        brain_id: 'opus-high',
        display_name: 'Opus High',
        model: 'anthropic/claude-opus-5',
        reasoning_effort: 'high',
        status: 'building',
    });

    it('parses project-local brain manifests', () => {
        expect(parseMemoryBrains([sol, opus])).toEqual([
            {
                brainId: 'sol-high',
                displayName: 'Sol High',
                model: 'openai/gpt-5.6-sol',
                reasoningEffort: 'high',
                partitionField: 'properties.published_at',
                partitionInterval: 'week',
                partitionOrder: 'ascending',
                generation: '7',
                lastRunId: 'sol-run-1',
                status: 'active',
            },
            {
                brainId: 'opus-high',
                displayName: 'Opus High',
                model: 'anthropic/claude-opus-5',
                reasoningEffort: 'high',
                partitionField: undefined,
                partitionInterval: undefined,
                partitionOrder: undefined,
                generation: undefined,
                lastRunId: undefined,
                status: 'building',
            },
        ]);
    });

    it('skips records without an identity or a model, and falls back to a draft status', () => {
        const records = [
            contentRecord('brain-no-id', 'No id', { model: 'anthropic/claude-opus-5' }),
            contentRecord('brain-no-model', 'No model', { brain_id: 'x' }),
            contentRecord('brain-bad-status', 'Bad status', { brain_id: 'y', model: 'm', status: 'exploded' }),
        ];
        const parsed = parseMemoryBrains(records);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toMatchObject({ brainId: 'y', displayName: 'Bad status', status: 'draft' });
    });

    it('honors a requested brain and otherwise prefers the active brain', () => {
        const brains = parseMemoryBrains([sol, opus]);

        expect(selectMemoryBrain(brains, 'opus-high')?.brainId).toBe('opus-high');
        expect(selectMemoryBrain(brains, 'missing')?.brainId).toBe('sol-high');
        expect(selectMemoryBrain(brains)?.brainId).toBe('sol-high');
        expect(selectMemoryBrain([])).toBeUndefined();
    });

    it('falls back to the first brain when none is active', () => {
        expect(selectMemoryBrain(parseMemoryBrains([opus]))?.brainId).toBe('opus-high');
    });

    it('builds an Elasticsearch DSL filter scoped to the selected brain', () => {
        const [brain] = parseMemoryBrains([sol]);

        expect(buildMemoryBrainFilter(brain)).toEqual({
            term: { 'properties.brain_id': 'sol-high' },
        });
    });

    it('shortens a namespaced model name for the status bar', () => {
        expect(formatModelName('anthropic/claude-opus-5')).toBe('claude-opus-5');
        expect(formatModelName('local-model')).toBe('local-model');
    });

    it('orders brains by status then display name, without mutating the input', () => {
        const brains = [
            brainStub('archived', 'Archived', 'archived'),
            brainStub('draft-z', 'Zulu', 'draft'),
            brainStub('active', 'Active', 'active'),
            brainStub('draft-a', 'Alpha', 'draft'),
            brainStub('building', 'Building', 'building'),
        ];

        expect(sortMemoryBrains(brains).map(({ brainId }) => brainId)).toEqual([
            'active',
            'building',
            'draft-a',
            'draft-z',
            'archived',
        ]);
        expect(brains[0]?.brainId).toBe('archived');
    });

    it('gives every status a semantic tone the catalog and the selector can share', () => {
        expect(memoryBrainStatusTone('active')).toBe('success');
        expect(memoryBrainStatusTone('building')).toBe('info');
        expect(memoryBrainStatusTone('paused')).toBe('attention');
        expect(memoryBrainStatusTone('degraded')).toBe('destructive');
        expect(memoryBrainStatusTone('archived')).toBe('done');
        expect(memoryBrainStatusTone('draft')).toBe('secondary');
    });
});
