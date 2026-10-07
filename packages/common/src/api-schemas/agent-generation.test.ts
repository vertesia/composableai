import { describe, expect, it } from 'vitest';
import type { ExperimentalAdmitAgentGenerationPayload } from '../agent-routing-control.js';
import { validateApiRequest } from '../api-contract/index.js';

const at = '2026-10-02T00:00:00.000Z';
const run = { id: 'execution', account: 'account', project: 'project' };
const completion = {
    task_token: 'opaque-task-token',
    run_id: 'actual-run',
    activity_id: 'native:1',
    canonical_state: { head: { conversation_id: 'conversation', revision: 1 }, scope: 'root' },
    canonical_output_reference: 'conversation_output_authority_v1',
    agent_acceptance: { version: 1, subject_agent_run_id: 'subject', activity_id: 'native:1', scope: 'root' },
} as const;
const requests = [
    {
        operation: 'user',
        request: {
            run,
            asyncCompletion: completion,
            input_append: {
                expected_revision: 1,
                operation_id: 'user:1',
                recorded_at: at,
                records: {
                    turns: [
                        {
                            id: 'turn:1',
                            kind: 'user',
                            authority: 'ordinary',
                            model_visibility: 'include',
                            status: 'completed',
                            timestamps: { recorded_at: at },
                            provenance: { type: 'received' },
                            blocks: [{ id: 'text:1', type: 'text', text: 'Continue.', format: 'plain' }],
                        },
                    ],
                },
            },
        },
    },
    {
        operation: 'tools',
        request: {
            run,
            asyncCompletion: completion,
            continuation_anchor: {
                kind: 'accepted_output',
                output_receipt: {
                    id: 'response:1',
                    conversation_id: 'conversation',
                    base_revision: 0,
                    result_revision: 1,
                    recorded_at: at,
                    accepted_turn_ids: ['turn:accepted'],
                    accepted_generation_ids: ['generation:1'],
                },
            },
        },
    },
    {
        operation: 'checkpoint_summary',
        request: {
            kind: 'checkpoint_summary',
            run,
            operation_id: 'checkpoint:1',
            source: {
                subject_agent_run_id: 'subject',
                conversation: { conversation_id: 'conversation', revision: 1 },
                scope: 'root',
            },
            control: { operation_id: 'routing:initial', revision: 0 },
            asyncCompletion: {
                task_token: completion.task_token,
                activity_id: completion.activity_id,
                run_id: completion.run_id,
            },
        },
    },
] satisfies ExperimentalAdmitAgentGenerationPayload[];

describe('exact pending native generation request envelope', () => {
    it.each(requests)('accepts the complete $operation request at the installed AJV boundary', (payload) => {
        expect(validateApiRequest('ExperimentalAdmitAgentGenerationPayload', payload)).toEqual({
            valid: true,
            data: payload,
        });
    });
    it.each(requests)('rejects caller-owned reservation authority for $operation', (payload) => {
        for (const field of [
            'request_id',
            'input_fingerprint',
            'execution',
            'expected_membership',
            'target',
            'control',
        ]) {
            expect(
                validateApiRequest('ExperimentalAdmitAgentGenerationPayload', { ...payload, [field]: {} }),
            ).toMatchObject({ valid: false });
        }
        expect(
            validateApiRequest('ExperimentalAdmitAgentGenerationPayload', {
                ...payload,
                request: { ...payload.request, target: { model: 'caller-model' } },
            }),
        ).toMatchObject({ valid: false });
        expect(
            validateApiRequest('ExperimentalAdmitAgentGenerationPayload', {
                ...payload,
                request: {
                    ...payload.request,
                    asyncCompletion: { ...payload.request.asyncCompletion, task_token: undefined },
                },
            }),
        ).toMatchObject({ valid: false });
    });
    it('requires the exact operation branch without mixed-purpose fields', () => {
        expect(
            validateApiRequest('ExperimentalAdmitAgentGenerationPayload', { request: requests[0].request }),
        ).toMatchObject({ valid: false });
        expect(
            validateApiRequest('ExperimentalAdmitAgentGenerationPayload', { ...requests[0], operation: 'future' }),
        ).toMatchObject({ valid: false });
        expect(
            validateApiRequest('ExperimentalAdmitAgentGenerationPayload', {
                operation: 'tools',
                request: requests[0].request,
            }),
        ).toMatchObject({ valid: false });
    });
});
