import { describe, expect, it } from 'vitest';
import type { ExperimentalAgentWorkstreamRestartAdmissionResponse } from '../agent-restart-admission.js';
import { validateApiRequest, validateApiResponse } from '../api-contract/index.js';
import {
    ExperimentalAgentWorkstreamRestartAdmissionPayloadSchema,
    ExperimentalAgentWorkstreamRestartAdmissionResponseSchema,
    ExperimentalAgentWorkstreamTerminalPayloadSchema,
    ExperimentalAgentWorkstreamTerminalResponseSchema,
} from './agent-restart-admission.js';

const retainedAdmission = {
    version: 1,
    request_id: 'accepted:request',
    input_fingerprint: 'accepted:input',
    admitted_at: '2026-10-03T00:00:00.000Z',
    execution: { workflow_id: 'accepted:workflow', chain_first_run_id: 'prior:first' },
    routing_control: {
        version: 2,
        kind: 'initial',
        origin_execution: { workflow_id: 'original:workflow', first_run_id: 'original:first' },
        owner: {
            account_id: 'account:1',
            project_id: 'project:1',
            subject_agent_run_id: 'subject:1',
            owner_agent_run_id: 'owner:1',
            scope: 'workstream:launch1',
            namespace_origin_first_run_id: 'original:first',
        },
        operation_id: 'routing:initial',
        recorded_at: '2026-10-03T00:00:00.000Z',
        payload_fingerprint: 'routing:hash',
        base_revision: 0,
        result_revision: 0,
        intent: { model: 'model:1' },
    },
} as const;

const payload = {
    version: 1,
    workflow_id: 'workstream:restart',
    run_id: 'delivery:1',
    activity_id: 'entry:1',
    task_token: 'dGFzay10b2tlbg',
};
const response: ExperimentalAgentWorkstreamRestartAdmissionResponse = {
    version: 1,
    kind: 'workstream_restart',
    status: 'admitted',
    subject_agent_run_id: 'subject:1',
    owner_agent_run_id: 'owner:1',
    scope: 'workstream:launch1',
    launch_id: 'launch1',
    workstream_id: 'task1',
    namespace_origin_first_run_id: 'original:first',
    execution: {
        workflow_id: 'workstream:restart',
        execution_run_id: 'delivery:1',
        first_run_id: 'restart:first',
        namespace: 'test',
        task_queue: 'agents',
        workflow_type: 'ExecuteConversationWorkflow',
        start_fingerprint: `sha256:${'a'.repeat(64)}`,
    },
    source: {
        execution_run_id: 'accepted:operational:run',
        generation_admission: retainedAdmission,
        source_first_run_id: 'prior:first',
        head: { conversation_id: 'canonical:1', revision: 5 },
        document_fingerprint: `sha256:${'b'.repeat(64)}`,
        accepted_output_fingerprint: `sha256:${'c'.repeat(64)}`,
    },
};

describe('strict workstream entry delivery and retained-source contracts', () => {
    it('keeps namespace origin distinct from predecessor source and new current chain', () => {
        expect(ExperimentalAgentWorkstreamRestartAdmissionPayloadSchema.parse(payload)).toEqual(payload);
        expect(validateApiRequest('ExperimentalAgentWorkstreamRestartAdmissionPayload', payload).valid).toBe(true);
        expect(ExperimentalAgentWorkstreamRestartAdmissionResponseSchema.parse(response)).toEqual(response);
        expect(validateApiResponse('ExperimentalAgentWorkstreamRestartAdmissionResponse', response).valid).toBe(true);
    });
    it('accepts exact maximum token, identifiers and workstream suffix bounds in both validators', () => {
        const maximumPayload = {
            ...payload,
            task_token: 'A'.repeat(16 * 1024),
            workflow_id: 'w'.repeat(1024),
            run_id: 'r'.repeat(1024),
            activity_id: 'a'.repeat(1024),
        };
        const launch = 'l'.repeat(128);
        const maximumResponse = { ...response, launch_id: launch, scope: `workstream:${launch}` };
        expect(ExperimentalAgentWorkstreamRestartAdmissionPayloadSchema.safeParse(maximumPayload).success).toBe(true);
        expect(validateApiRequest('ExperimentalAgentWorkstreamRestartAdmissionPayload', maximumPayload).valid).toBe(
            true,
        );
        expect(ExperimentalAgentWorkstreamRestartAdmissionResponseSchema.safeParse(maximumResponse).success).toBe(true);
        expect(validateApiResponse('ExperimentalAgentWorkstreamRestartAdmissionResponse', maximumResponse).valid).toBe(
            true,
        );
    });
    it.each([
        ['oversized token', { ...payload, task_token: 'A'.repeat(16 * 1024 + 1) }],
        ['oversized workflow ID', { ...payload, workflow_id: 'w'.repeat(1025) }],
        ['oversized run ID', { ...payload, run_id: 'r'.repeat(1025) }],
        ['oversized activity ID', { ...payload, activity_id: 'a'.repeat(1025) }],
    ])('rejects %s at the delivery boundary', (_label, input) => {
        expect(ExperimentalAgentWorkstreamRestartAdmissionPayloadSchema.safeParse(input).success).toBe(false);
        expect(validateApiRequest('ExperimentalAgentWorkstreamRestartAdmissionPayload', input).valid).toBe(false);
    });
    it.each([
        [
            'missing immutable source admission',
            { ...response, source: { ...response.source, generation_admission: undefined } },
        ],
        [
            'wrong immutable source admission type',
            { ...response, source: { ...response.source, generation_admission: 17 } },
        ],
        ['extra immutable source target config', { ...response, source: { ...response.source, target_config: {} } }],
        ['empty scope suffix', { ...response, scope: 'workstream:' }],
        ['oversized scope suffix', { ...response, scope: `workstream:${'l'.repeat(129)}` }],
        ['oversized launch ID', { ...response, launch_id: 'l'.repeat(129) }],
        ['oversized subject ID', { ...response, subject_agent_run_id: 's'.repeat(1025) }],
    ])('rejects %s in retained entry shape', (_label, input) => {
        expect(ExperimentalAgentWorkstreamRestartAdmissionResponseSchema.safeParse(input).success).toBe(false);
        expect(validateApiResponse('ExperimentalAgentWorkstreamRestartAdmissionResponse', input).valid).toBe(false);
    });
    it.each(['subject_agent_run_id', 'source', 'target', 'generation_admission', 'config', 'entry'])(
        'rejects caller %s authority in Zod and generated AJV',
        (key) => {
            const input = { ...payload, [key]: 'forged' };
            expect(ExperimentalAgentWorkstreamRestartAdmissionPayloadSchema.safeParse(input).success).toBe(false);
            expect(validateApiRequest('ExperimentalAgentWorkstreamRestartAdmissionPayload', input).valid).toBe(false);
        },
    );
    it.each([
        { ...payload, version: 2 },
        { ...payload, task_token: '' },
        { ...payload, task_token: 'not base64!' },
        { ...payload, run_id: undefined },
        { ...payload, activity_id: 17 },
    ])('rejects malformed exact delivery %j', (input) => {
        expect(ExperimentalAgentWorkstreamRestartAdmissionPayloadSchema.safeParse(input).success).toBe(false);
        expect(validateApiRequest('ExperimentalAgentWorkstreamRestartAdmissionPayload', input).valid).toBe(false);
    });
    it.each([
        { ...response, source: { ...response.source, execution_run_id: undefined } },
        { ...response, source: { ...response.source, execution_run_id: 'r'.repeat(1025) } },
        { ...response, target_config: {} },
        { ...response, scope: 'root' },
        { ...response, source: { ...response.source, accepted_output_fingerprint: 'unverified' } },
        { ...response, execution: { ...response.execution, workflow_type: 'ExecuteAdmittedAgentRestartWorkflowV2' } },
        { ...response, namespace_origin_first_run_id: undefined },
    ])('rejects incomplete or foreign entry %j', (input) => {
        expect(ExperimentalAgentWorkstreamRestartAdmissionResponseSchema.safeParse(input).success).toBe(false);
        expect(validateApiResponse('ExperimentalAgentWorkstreamRestartAdmissionResponse', input).valid).toBe(false);
    });
});

describe('bounded workstream terminal nomination contracts', () => {
    const terminal = {
        version: 1,
        subject_agent_run_id: 'subject:1',
        workflow_id: 'child:1',
        chain_first_run_id: 'first:1',
    };
    it('accepts a subject-bound nomination and exact identifier bounds', () => {
        const maximum = {
            ...terminal,
            subject_agent_run_id: 's'.repeat(1024),
            workflow_id: 'w'.repeat(1024),
            chain_first_run_id: 'r'.repeat(1024),
        };
        for (const value of [terminal, maximum]) {
            expect(ExperimentalAgentWorkstreamTerminalPayloadSchema.safeParse(value).success).toBe(true);
            expect(validateApiRequest('ExperimentalAgentWorkstreamTerminalPayload', value).valid).toBe(true);
        }
    });
    it.each(['running', 'projected', 'already_projected', 'not_current'])('accepts observed %s outcome', (outcome) => {
        const value = { version: 1, outcome };
        expect(ExperimentalAgentWorkstreamTerminalResponseSchema.safeParse(value).success).toBe(true);
        expect(validateApiResponse('ExperimentalAgentWorkstreamTerminalResponse', value).valid).toBe(true);
    });
    it.each([
        { ...terminal, subject_agent_run_id: undefined },
        { ...terminal, subject_agent_run_id: '' },
        { ...terminal, subject_agent_run_id: 's'.repeat(1025) },
        { ...terminal, workflow_id: 'w'.repeat(1025) },
        { ...terminal, chain_first_run_id: 'r'.repeat(1025) },
        { ...terminal, status: 'completed' },
        { ...terminal, generation_admission: {} },
        { ...terminal, version: 2 },
    ])('rejects caller status or malformed nomination %j', (value) => {
        expect(ExperimentalAgentWorkstreamTerminalPayloadSchema.safeParse(value).success).toBe(false);
        expect(validateApiRequest('ExperimentalAgentWorkstreamTerminalPayload', value).valid).toBe(false);
    });
    it.each([
        { version: 1, outcome: 'completed' },
        { version: 1, outcome: 'projected', status: 'completed' },
        { version: 1 },
        { version: 2, outcome: 'running' },
    ])('rejects incomplete or extra terminal result %j', (value) => {
        expect(ExperimentalAgentWorkstreamTerminalResponseSchema.safeParse(value).success).toBe(false);
        expect(validateApiResponse('ExperimentalAgentWorkstreamTerminalResponse', value).valid).toBe(false);
    });
});
