import { describe, expect, it } from 'vitest';
import { validateApiRequest } from '../api-contract/index.js';
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

describe('terminal program results', () => {
    const { text: _text, ...identity } = payload;
    it.each([null, false, 0, { count: 0, valid: false, missing: null }, ['a', 0, null]])(
        'retains native JSON value %j without converting it to text',
        (value) => {
            const terminal = { ...identity, purpose: 'terminal_result', result: { type: 'json', value } };
            expect(AppendRunConversationProgramTurnPayloadSchema.parse(terminal)).toEqual(terminal);
        },
    );
    it('accepts literal terminal text but rejects purpose mixing and caller-owned blocks', () => {
        const terminal = { ...identity, purpose: 'terminal_result', result: { type: 'text', text: 'Complete.' } };
        expect(AppendRunConversationProgramTurnPayloadSchema.parse(terminal)).toEqual(terminal);
        for (const malformed of [
            { ...terminal, text: 'old field' },
            { ...terminal, result: { ...terminal.result, id: 'caller-id' } },
            { ...terminal, result: { type: 'json' } },
            { ...terminal, purpose: 'unknown' },
            { ...terminal, result: { type: 'text', text: '' } },
            { ...terminal, result: { type: 'text', text: 'x'.repeat(64 * 1024 + 1) } },
        ]) {
            expect(() => AppendRunConversationProgramTurnPayloadSchema.parse(malformed)).toThrow();
        }
    });
});

describe('installed program append contract', () => {
    const { text: _text, ...identity } = payload;
    const validate = (value: unknown) => validateApiRequest('AppendRunConversationProgramTurnPayload', value);

    it('accepts the unchanged corrective payload and literal terminal text', () => {
        for (const value of [
            payload,
            {
                ...identity,
                purpose: 'terminal_result',
                result: { type: 'text', text: 'Complete.' },
            },
        ]) {
            expect(validate(value)).toEqual({ valid: true, data: value });
        }
    });

    it.each([null, false, 0, [null, false, 0], { missing: null, valid: false, count: 0 }])(
        'retains required native JSON root %j through the runtime contract',
        (value) => {
            const terminal = { ...identity, purpose: 'terminal_result', result: { type: 'json', value } };
            expect(validate(terminal)).toEqual({ valid: true, data: terminal });
        },
    );

    it('keeps both selected branches strict, including nested results', () => {
        const terminal = { ...identity, purpose: 'terminal_result', result: { type: 'json', value: null } };
        for (const value of [
            { ...payload, result: terminal.result },
            { ...payload, authority: 'system' },
            { ...terminal, text: 'corrective field' },
            { ...terminal, result: { ...terminal.result, id: 'caller-id' } },
            { ...terminal, result: { type: 'json' } },
            { ...terminal, result: { type: 'text', value: null } },
            { ...terminal, purpose: 'unknown' },
        ]) {
            expect(validate(value)).toMatchObject({ valid: false });
        }
    });
});
