import { describe, expect, it } from 'vitest';
import { ExperimentalAgentConversationDeletePayloadSchema } from './agent-runs.js';
import { validateApiRequest } from './registry.js';

const payload = {
    operation_id: 'delete:one',
    expected_head: { conversation_id: 'conversation:one', revision: 2 },
    dependency_policy: 'reject',
    turn_ids: ['turn:one'],
};

describe('canonical logical-delete wire contract', () => {
    it('shares finite canonical source/turn/dependency constraints between Zod and runtime AJV', () => {
        expect(ExperimentalAgentConversationDeletePayloadSchema.safeParse(payload).success).toBe(true);
        expect(validateApiRequest('ExperimentalAgentConversationDeletePayload', payload).valid).toBe(true);
        expect(
            ExperimentalAgentConversationDeletePayloadSchema.safeParse({ ...payload, context_policy: 'exclude' })
                .success,
        ).toBe(true);
        expect(
            validateApiRequest('ExperimentalAgentConversationDeletePayload', { ...payload, context_policy: 'exclude' })
                .valid,
        ).toBe(true);
        for (const invalid of [
            { ...payload, context_policy: 'cascade' },
            { ...payload, recorded_at: '2026-10-06T00:00:00.000Z' },
            { ...payload, expected_source_root: { content_hash: 'sha256:forged', size_bytes: 1 } },
            { ...payload, dependency_policy: 'cascade' },
            { ...payload, turn_ids: [] },
            { ...payload, turn_ids: Array.from({ length: 4097 }, (_, index) => `turn:${index}`) },
            { ...payload, expected_head: { ...payload.expected_head, revision: -1 } },
        ]) {
            expect(ExperimentalAgentConversationDeletePayloadSchema.safeParse(invalid).success).toBe(false);
            expect(validateApiRequest('ExperimentalAgentConversationDeletePayload', invalid).valid).toBe(false);
        }
    });
});
