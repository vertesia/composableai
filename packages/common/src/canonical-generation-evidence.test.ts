import { describe, expect, it } from 'vitest';
import {
    assertCanonicalScopedGenerationEvidence,
    assertConversationAcceptedGenerationEvidence,
} from './canonical-generation-evidence.js';
import type {
    CanonicalContinuationState,
    CanonicalScopedGenerationEvidence,
    ConversationAcceptedGenerationEvidence,
} from './interaction.js';

function generationEvidence(): ConversationAcceptedGenerationEvidence {
    return {
        receipt: {
            id: 'operation:response',
            conversation_id: 'conversation-1',
            base_revision: 3,
            result_revision: 4,
            recorded_at: '2026-10-01T00:00:01.000Z',
            accepted_turn_ids: ['turn-1'],
            accepted_generation_ids: ['generation-1'],
        },
        generation: {
            id: 'generation-1',
            record_source: 'executed',
            request_id: 'request-1',
            attempt_id: 'attempt-1',
            purpose: 'conversation',
            requested_model: 'model-1',
            provider: 'provider-1',
            protocol: 'protocol-1',
            adapter_version: 'adapter-1',
            status: 'completed',
            finish_reason: 'stop',
            timestamps: { recorded_at: '2026-10-01T00:00:01.000Z' },
            source: { conversation_id: 'conversation-1', revision: 3 },
            usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
        },
    };
}

describe('accepted generation evidence semantics', () => {
    it('accepts one exact receipt-bound executed generation', () => {
        expect(() => assertConversationAcceptedGenerationEvidence(generationEvidence())).not.toThrow();
    });

    it.each([
        ['result revision', (value: ConversationAcceptedGenerationEvidence) => (value.receipt.result_revision = 5)],
        [
            'accepted generation',
            (value: ConversationAcceptedGenerationEvidence) => (value.receipt.accepted_generation_ids = ['other']),
        ],
        [
            'source conversation',
            (value: ConversationAcceptedGenerationEvidence) =>
                (value.generation.source = { conversation_id: 'other', revision: 3 }),
        ],
        [
            'source revision',
            (value: ConversationAcceptedGenerationEvidence) =>
                (value.generation.source = { conversation_id: 'conversation-1', revision: 2 }),
        ],
    ])('rejects a mismatched %s', (_label, mutate) => {
        const evidence = generationEvidence();
        mutate(evidence);
        expect(() => assertConversationAcceptedGenerationEvidence(evidence)).toThrow(
            'inconsistent receipt and generation references',
        );
    });

    it.each([
        ['scope', (value: CanonicalScopedGenerationEvidence) => (value.scope = 'workstream:other')],
        [
            'conversation',
            (_value: CanonicalScopedGenerationEvidence, state: CanonicalContinuationState) => {
                state.head.conversation_id = 'conversation-2';
            },
        ],
        [
            'head revision',
            (_value: CanonicalScopedGenerationEvidence, state: CanonicalContinuationState) => {
                state.head.revision = 3;
            },
        ],
    ])('rejects a mismatched agent %s binding', (_label, mutate) => {
        const evidence: CanonicalScopedGenerationEvidence = { ...generationEvidence(), scope: 'root' };
        const state: CanonicalContinuationState = {
            head: { conversation_id: 'conversation-1', revision: 5 },
            scope: 'root',
        };
        mutate(evidence, state);
        expect(() => assertCanonicalScopedGenerationEvidence(evidence, state)).toThrow(
            'does not match its canonical agent-run head and scope',
        );
    });
});
