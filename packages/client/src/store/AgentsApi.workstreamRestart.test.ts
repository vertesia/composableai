import type {
    ExperimentalAgentWorkstreamRestartAdmissionPayload,
    ExperimentalAgentWorkstreamRestartAdmissionResponse,
    ExperimentalAgentWorkstreamTerminalPayload,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

const retainedAdmission = {
    version: 1,
    request_id: 'accepted:request',
    input_fingerprint: 'accepted:input',
    admitted_at: '2026-10-03T00:00:00.000Z',
    execution: { workflow_id: 'accepted:workflow', chain_first_run_id: 'previous:first' },
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

describe('AgentsApi genuine workstream entry delivery', () => {
    it('posts only the actual token and delivery identity to the encoded owner with exact version', async () => {
        const requests: Request[] = [];
        const payload = {
            version: 1,
            workflow_id: 'workstream:restart',
            run_id: 'current:delivery',
            activity_id: 'entry:1',
            task_token: 'dGFzay10b2tlbg',
        } satisfies ExperimentalAgentWorkstreamRestartAdmissionPayload;
        const response = {
            version: 1,
            kind: 'workstream_restart',
            status: 'admitted',
            subject_agent_run_id: 'child:1',
            owner_agent_run_id: 'owner:1',
            scope: 'workstream:launch1',
            launch_id: 'launch1',
            workstream_id: 'task1',
            namespace_origin_first_run_id: 'original:first',
            execution: {
                workflow_id: payload.workflow_id,
                execution_run_id: payload.run_id,
                first_run_id: 'new:first',
                namespace: 'test',
                task_queue: 'agents',
                workflow_type: 'ExecuteConversationWorkflow',
                start_fingerprint: `sha256:${'a'.repeat(64)}`,
            },
            source: {
                execution_run_id: 'retained:accepted:run',
                generation_admission: retainedAdmission,
                source_first_run_id: 'previous:first',
                head: { conversation_id: 'canonical:1', revision: 5 },
                document_fingerprint: `sha256:${'b'.repeat(64)}`,
                accepted_output_fingerprint: `sha256:${'c'.repeat(64)}`,
            },
        } satisfies ExperimentalAgentWorkstreamRestartAdmissionResponse;
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'owner-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json(response);
            }) as typeof fetch,
        });
        const controller = new AbortController();
        await expect(
            client.agents.admitWorkstreamRestartExecution('owner/with slash', payload, {
                signal: controller.signal,
                headers: { 'x-trace': 'workstream-entry' },
                timeoutMs: 30_000,
            }),
        ).resolves.toEqual(response);
        expect(requests).toHaveLength(1);
        const request = requests[0];
        expect(new URL(request.url).pathname).toBe('/api/v1/agents/owner%2Fwith%20slash/workstream/restart/admission');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(request.headers.get('x-trace')).toBe('workstream-entry');
        expect(await request.json()).toEqual(payload);
        expect(request.signal.aborted).toBe(false);
        controller.abort();
        expect(request.signal.aborted).toBe(true);
    });
});

describe('AgentsApi subject-bound terminal nomination', () => {
    it('uses the exact-version encoded subject route without caller status authority', async () => {
        const requests: Request[] = [];
        const payload = {
            version: 1,
            subject_agent_run_id: 'child/owned',
            workflow_id: 'child:workflow',
            chain_first_run_id: 'child:first',
        } satisfies ExperimentalAgentWorkstreamTerminalPayload;
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'owner-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json({ version: 1, outcome: 'projected' });
            }) as typeof fetch,
        });
        const controller = new AbortController();
        await expect(
            client.agents.projectWorkstreamTerminal(payload.subject_agent_run_id, payload, {
                signal: controller.signal,
                timeoutMs: 30_000,
            }),
        ).resolves.toEqual({ version: 1, outcome: 'projected' });
        expect(requests).toHaveLength(1);
        const request = requests[0];
        expect(new URL(request.url).pathname).toBe('/api/v1/agents/child%2Fowned/workstream/terminal');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(await request.json()).toEqual(payload);
        controller.abort();
        expect(request.signal.aborted).toBe(true);
    });
});
