import { describe, expect, it } from 'vitest';
import type { ExperimentalAgentRestartAdmissionResponse } from '../agent-restart-admission.js';
import { validateApiRequest, validateApiResponse } from '../api-contract/index.js';
import {
    ExperimentalAgentRestartAdmissionPayloadSchema,
    ExperimentalAgentRestartAdmissionResponseSchema,
} from './agent-restart-admission.js';

const token = '12345678-1234-1234-1234-123456789abc';
const payload = { version: 2, token };
const response: ExperimentalAgentRestartAdmissionResponse = {
    version: 2,
    status: 'admitted',
    token,
    policy_id: `sha256:${'a'.repeat(64)}`,
    execution: {
        workflow_id: 'restart:1',
        first_run_id: 'chain:1',
        execution_run_id: 'delivery:2',
        namespace: 'namespace:1',
        task_queue: 'queue:1',
        workflow_type: 'ExecuteAdmittedAgentRestartWorkflowV2',
        start_fingerprint: `sha256:${'b'.repeat(64)}`,
    },
};
describe('registered strict restart admission contracts', () => {
    it('publishes the exact token request and actual admitted execution response', () => {
        expect(ExperimentalAgentRestartAdmissionPayloadSchema.parse(payload)).toEqual(payload);
        expect(validateApiRequest('ExperimentalAgentRestartAdmissionPayload', payload).valid).toBe(true);
        expect(ExperimentalAgentRestartAdmissionResponseSchema.parse(response)).toEqual(response);
        expect(validateApiResponse('ExperimentalAgentRestartAdmissionResponse', response).valid).toBe(true);
    });
    it.each(['execution', 'owner', 'scope', 'start_fingerprint', 'policy_id'])(
        'rejects caller authority %s in both Zod and installed AJV',
        (key) => {
            const input = { ...payload, [key]: 'forged' };
            expect(ExperimentalAgentRestartAdmissionPayloadSchema.safeParse(input).success).toBe(false);
            expect(validateApiRequest('ExperimentalAgentRestartAdmissionPayload', input).valid).toBe(false);
        },
    );
    it.each([
        { version: 1, token },
        { version: 2, token: '' },
        { version: 2, token: 'invalid' },
    ])('rejects old or malformed intents: %j', (input) => {
        expect(ExperimentalAgentRestartAdmissionPayloadSchema.safeParse(input).success).toBe(false);
        expect(validateApiRequest('ExperimentalAgentRestartAdmissionPayload', input).valid).toBe(false);
    });
    it('rejects fabricated types, missing delivery evidence and unknown response fields', () => {
        for (const input of [
            { ...response, version: 1 },
            { ...response, secret: token },
            { ...response, execution: { ...response.execution, workflow_type: 'ExecuteConversationWorkflow' } },
            { ...response, execution: { ...response.execution, execution_run_id: undefined } },
        ]) {
            expect(ExperimentalAgentRestartAdmissionResponseSchema.safeParse(input).success).toBe(false);
            expect(validateApiResponse('ExperimentalAgentRestartAdmissionResponse', input).valid).toBe(false);
        }
    });
});
