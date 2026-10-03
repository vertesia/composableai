import { describe, expect, it } from 'vitest';
import { validateApiRequest } from '../api-contract/index.js';
import {
    AppendRunConversationProgramTurnPayloadSchema,
    ExperimentalCanonicalToolCatalogSelectionHeadPayloadSchema,
    ExperimentalCanonicalVersionedHeadPayloadSchema,
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

describe('guarded tool catalog head contract', () => {
    const value = {
        kind: 'tool_catalog_selection',
        request: {
            run: { id: 'execution:catalog', account: 'account:catalog', project: 'project:catalog' },
            asyncCompletion: {
                run_id: 'run:catalog',
                activity_id: 'activity:catalog',
                task_token: 'opaque:catalog',
                canonical_state: {
                    head: { conversation_id: 'conversation:catalog', revision: 2 },
                    scope: 'root',
                },
                agent_acceptance: {
                    version: 1,
                    subject_agent_run_id: 'subject:catalog',
                    scope: 'root',
                    activity_id: 'activity:catalog',
                },
                canonical_output_reference: 'conversation_output_authority_v1',
            },
            continuation_anchor: {
                kind: 'materialized_tool_input',
                materialized_input: { operation_id: 'input:catalog', result_revision: 2 },
            },
        },
    };
    const validate = (input: unknown) =>
        validateApiRequest('ExperimentalCanonicalToolCatalogSelectionHeadPayload', input);
    it('accepts only the original scheduled tools nomination on the existing strict head union', () => {
        expect(ExperimentalCanonicalToolCatalogSelectionHeadPayloadSchema.parse(value)).toEqual(value);
        expect(ExperimentalCanonicalVersionedHeadPayloadSchema.parse(value)).toEqual(value);
        expect(validate(value)).toEqual({ valid: true, data: value });
    });
    it('accepts a bounded exact retained selection constraint but grants no caller-owned recovery flag', () => {
        const constrained = {
            ...value,
            retained_selection: {
                operation_id: 'catalog:one',
                result_revision: 3,
                receipt_fingerprint: `sha256:${'a'.repeat(64)}`,
            },
        };
        expect(ExperimentalCanonicalToolCatalogSelectionHeadPayloadSchema.parse(constrained)).toEqual(constrained);
        expect(validate(constrained)).toEqual({ valid: true, data: constrained });
        for (const malformed of [
            { ...constrained, recovery: true },
            { ...constrained, retained_selection: true },
            { ...constrained, retained_selection: { ...constrained.retained_selection, operation_id: '' } },
            { ...constrained, retained_selection: { ...constrained.retained_selection, result_revision: -1 } },
            {
                ...constrained,
                retained_selection: { ...constrained.retained_selection, receipt_fingerprint: 'unbound' },
            },
            { ...constrained, retained_selection: { ...constrained.retained_selection, target: {} } },
        ]) {
            expect(() => ExperimentalCanonicalToolCatalogSelectionHeadPayloadSchema.parse(malformed)).toThrow();
            expect(validate(malformed)).toMatchObject({ valid: false });
        }
    });
    it.each(['catalog_intent', 'tool_definitions', 'active_tool_definition_ids', 'target', 'config'])(
        'rejects caller-owned %s at both transport levels',
        (field) => {
            for (const malformed of [
                { ...value, [field]: [] },
                { ...value, request: { ...value.request, [field]: [] } },
            ]) {
                expect(() => ExperimentalCanonicalToolCatalogSelectionHeadPayloadSchema.parse(malformed)).toThrow();
                expect(validate(malformed)).toMatchObject({ valid: false });
            }
        },
    );
    it('preserves required actual token, activity and original scope bindings', () => {
        for (const malformed of [
            {
                ...value,
                request: { ...value.request, asyncCompletion: { ...value.request.asyncCompletion, task_token: '' } },
            },
            {
                ...value,
                request: { ...value.request, asyncCompletion: { ...value.request.asyncCompletion, activity_id: '' } },
            },
            { ...value, request: { ...value.request, continuation_anchor: { kind: 'materialized_tool_input' } } },
        ]) {
            expect(() => ExperimentalCanonicalToolCatalogSelectionHeadPayloadSchema.parse(malformed)).toThrow();
            expect(validate(malformed)).toMatchObject({ valid: false });
        }
    });
});
