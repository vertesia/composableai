import { describe, expect, it } from 'vitest';
import { validateApiRequest, validateApiResponse } from '../api-contract/index.js';
import type {
    ExperimentalCanonicalAsyncCompletionOptions,
    ExperimentalCanonicalToolResultsPayload,
    ExperimentalCanonicalUserMessagePayload,
} from '../canonical-conversation-resume.js';

const at = '2026-10-01T00:00:00.000Z';
const asyncCompletion = {
    run_id: 'temporal-current-after-can',
    task_token: 'task-token-base64url',
    activity_id: 'activity:resume',
    canonical_state: { head: { conversation_id: 'conversation:resume', revision: 4 }, scope: 'root' },
    agent_acceptance: {
        version: 1,
        subject_agent_run_id: 'agent:owner',
        scope: 'root',
        activity_id: 'activity:resume',
    },
    canonical_output_reference: 'conversation_output_authority_v1',
} satisfies ExperimentalCanonicalAsyncCompletionOptions;
const resume = { run: { id: 'execution:1', account: 'account:1', project: 'project:1' }, asyncCompletion };
const user = {
    ...resume,
    config: { environment: 'environment:1', model: 'model:1' },
    turn_selection: { mode: 'auto' },
    input_append: {
        expected_revision: 4,
        operation_id: 'input:user',
        recorded_at: at,
        records: {
            turns: [
                {
                    id: 'user:1',
                    kind: 'user',
                    authority: 'ordinary',
                    model_visibility: 'include',
                    status: 'completed',
                    timestamps: { recorded_at: at },
                    provenance: { type: 'received' },
                    blocks: [{ id: 'text:user', type: 'text', text: 'Continue.', format: 'plain' }],
                },
            ],
            context_entries: [{ id: 'context:user', type: 'source_turn', turn_id: 'user:1' }],
        },
    },
} satisfies ExperimentalCanonicalUserMessagePayload;
const tools = {
    ...resume,
    asyncCompletion: {
        ...asyncCompletion,
        canonical_state: {
            ...asyncCompletion.canonical_state,
            materialized_input: { operation_id: 'input:tools', result_revision: 4 },
        },
    },
} satisfies ExperimentalCanonicalToolResultsPayload;

describe('exact-version canonical resume contracts', () => {
    it('carries native user additions or durable tool-input authority without content mirrors', () => {
        expect(validateApiRequest('ExperimentalCanonicalUserMessagePayload', user)).toEqual({
            valid: true,
            data: user,
        });
        expect(validateApiRequest('ExperimentalCanonicalToolResultsPayload', tools)).toEqual({
            valid: true,
            data: tools,
        });
    });

    it.each(['conversation', 'results', 'tools', 'strip_options', 'options', 'environment', 'message'])(
        'rejects the legacy outer %s field in both current requests',
        (field) => {
            expect(
                validateApiRequest('ExperimentalCanonicalUserMessagePayload', { ...user, [field]: [] }),
            ).toMatchObject({ valid: false });
            expect(
                validateApiRequest('ExperimentalCanonicalToolResultsPayload', { ...tools, [field]: [] }),
            ).toMatchObject({ valid: false });
        },
    );

    it('rejects copied host state and requires exact callback transport', () => {
        for (const options of [
            { ...asyncCompletion, current_state: { output: [] } },
            { ...asyncCompletion, output: [] },
            { ...asyncCompletion, task_token: undefined },
            { ...asyncCompletion, canonical_output_reference: 'conversation_output_receipt_v1' },
        ]) {
            expect(
                validateApiRequest('ExperimentalCanonicalUserMessagePayload', { ...user, asyncCompletion: options }),
            ).toMatchObject({ valid: false });
        }
    });

    it('requires a persisted materialized input reference for tool resumes', () => {
        expect(
            validateApiRequest('ExperimentalCanonicalToolResultsPayload', { ...tools, asyncCompletion }),
        ).toMatchObject({ valid: false });
        expect(
            validateApiRequest('ExperimentalCanonicalToolResultsPayload', {
                ...tools,
                input_append: user.input_append,
            }),
        ).toMatchObject({ valid: false });
    });

    it('rejects caller fingerprints, generated evidence and elevated user authority', () => {
        const records = user.input_append.records;
        const turn = records.turns[0];
        if (!turn) throw new Error('Expected a native user turn');
        for (const input of [
            { ...user.input_append, payload_fingerprint: 'caller-owned' },
            { ...user.input_append, records: { ...records, generations: [] } },
            { ...user.input_append, records: { ...records, execution_receipts: [] } },
            { ...user.input_append, records: { ...records, turns: [{ ...turn, authority: 'system' }] } },
            { ...user.input_append, records: { ...records, turns: [{ ...turn, provenance: { type: 'generated' } }] } },
            { ...user.input_append, records: { ...records, turns: [] } },
        ]) {
            expect(
                validateApiRequest('ExperimentalCanonicalUserMessagePayload', { ...user, input_append: input }),
            ).toMatchObject({ valid: false });
        }
    });

    it('keeps dispatch acknowledgement separate from durable semantic response acceptance', () => {
        const accepted = { status: 'accepted', run_id: 'execution:1', activity_id: 'activity:resume' };
        expect(validateApiResponse('ExperimentalCanonicalResumeAccepted', accepted)).toEqual({
            valid: true,
            data: accepted,
        });
        expect(validateApiResponse('ExperimentalCanonicalResumeAccepted', { ...accepted, result: [] })).toMatchObject({
            valid: false,
        });
    });
});
