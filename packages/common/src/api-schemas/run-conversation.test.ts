import { createConversationDocument, createUserTurn } from '@llumiverse/conversation';
import { ConversationDocumentSchema } from '@llumiverse/conversation/schemas';
import { describe, expect, it } from 'vitest';
import { validateApiResponse } from '../api-contract/index.js';
import { CANONICAL_CONVERSATION_SCHEMAS } from './canonical-conversation.js';
import { RunConversationResponseSchema } from './run-conversation.js';

function availableHistory() {
    const at = '2026-09-12T00:00:00.000Z';
    const conversation = createConversationDocument({ id: 'history', created_at: at });
    conversation.turns.push(
        createUserTurn({
            id: 'user',
            authority: 'ordinary',
            status: 'completed',
            model_visibility: 'include',
            provenance: { type: 'received' },
            timestamps: { recorded_at: at },
            blocks: [{ id: 'json', type: 'json', value: { nested: [null, true, { message: 'original' }] } }],
        }),
    );
    return { status: 'available', conversation } as const;
}

describe('run conversation wire contract', () => {
    it('keeps the complete named canonical schema closure strict and publicly owned', () => {
        const emitted = ConversationDocumentSchema.toJSONSchema({ target: 'draft-2020-12', io: 'input' });
        expect(Object.keys(CANONICAL_CONVERSATION_SCHEMAS).sort()).toEqual(Object.keys(emitted.$defs ?? {}).sort());
    });

    it('preserves recursive JSON and matches runtime enforcement', () => {
        const response = availableHistory();
        expect(RunConversationResponseSchema.parse(response)).toEqual(response);
        expect(validateApiResponse('RunConversationResponse', response)).toMatchObject({ valid: true });
    });

    it.each(['not_recorded', 'retention_policy', 'pruned'] as const)(
        'reports %s without pretending history exists',
        (reason) => {
            const response = { status: 'unavailable', reason };
            expect(RunConversationResponseSchema.safeParse(response).success).toBe(true);
            expect(validateApiResponse('RunConversationResponse', response)).toMatchObject({ valid: true });
        },
    );

    it.each([
        { ...availableHistory(), artifact: { path: 'private' } },
        { status: 'unavailable', reason: 'retention_policy', conversation: availableHistory().conversation },
        { status: 'available', conversation: { ...availableHistory().conversation, unexpected: true } },
        { status: 'unavailable', reason: 'unknown' },
    ])('rejects undocumented data at both validation boundaries', (response) => {
        expect(RunConversationResponseSchema.safeParse(response).success).toBe(false);
        expect(validateApiResponse('RunConversationResponse', response).valid).toBe(false);
    });

    it('rejects unknown properties inside canonical content blocks', () => {
        const response = availableHistory();
        const block = response.conversation.turns[0]?.blocks[0];
        expect(block).toBeDefined();
        if (!block) throw new Error('Fixture must contain a content block');
        Object.assign(block, { private_locator: 'not a canonical field' });
        expect(RunConversationResponseSchema.safeParse(response).success).toBe(false);
        expect(validateApiResponse('RunConversationResponse', response).valid).toBe(false);
    });
});
