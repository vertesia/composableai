import { describe, expect, it } from 'vitest';
import {
    AppendRunConversationProgramTurnPayloadSchema,
    MAX_APPEND_RUN_CONVERSATION_PROGRAM_TEXT_CODE_UNITS,
} from './run-conversation-append.js';

const payload = {
    conversation_id: 'conversation:1',
    expected_revision: 4,
    operation_id: 'program:corrective:1',
    recorded_at: '2026-09-30T00:00:00.000Z',
    purpose: 'controller_corrective' as const,
    text: 'Stop repeating the same failed tool call.',
};

describe('AppendRunConversationProgramTurnPayloadSchema', () => {
    it('accepts only bounded corrective text and append identity', () => {
        expect(AppendRunConversationProgramTurnPayloadSchema.parse(payload)).toEqual(payload);
        expect(() =>
            AppendRunConversationProgramTurnPayloadSchema.parse({
                ...payload,
                text: 'x'.repeat(MAX_APPEND_RUN_CONVERSATION_PROGRAM_TEXT_CODE_UNITS + 1),
            }),
        ).toThrow();
    });

    it.each([
        ['authority', 'system'],
        ['provenance', { type: 'received' }],
        ['model_visibility', 'exclude'],
        ['blocks', []],
        ['metadata', { injected: true }],
    ])('rejects caller-owned %s', (field, value) => {
        expect(() => AppendRunConversationProgramTurnPayloadSchema.parse({ ...payload, [field]: value })).toThrow();
    });
});
