import type {
    ExperimentalAgentRestartAdmissionPayload,
    ExperimentalAgentRestartAdmissionResponse,
    ExperimentalAgentRoutingControlResponse,
    ExperimentalUpdateAgentRoutingControlPayload,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

describe('AgentsApi owner-authenticated restart delivery admission', () => {
    it('sends the strict token-only request to the encoded subject with exact version and abort signal', async () => {
        const requests: Request[] = [];
        const response: ExperimentalAgentRestartAdmissionResponse = {
            version: 2,
            status: 'admitted',
            token: '12345678-1234-1234-1234-123456789abc',
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
        const payload = { version: 2, token: response.token } satisfies ExperimentalAgentRestartAdmissionPayload;
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'existing-owner-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json(response);
            }) as typeof fetch,
        });
        const controller = new AbortController();
        await expect(
            client.agents.admitRestartExecution('subject/with slash', payload, {
                signal: controller.signal,
                headers: { 'x-trace': 'admission' },
            }),
        ).resolves.toEqual(response);
        const request = requests[0];
        expect(new URL(request.url).pathname).toBe('/api/v1/agents/subject%2Fwith%20slash/restart/admission');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(request.headers.get('x-trace')).toBe('admission');
        expect(request.signal.aborted).toBe(false);
        controller.abort();
        expect(request.signal.aborted).toBe(true);
        expect(await request.json()).toEqual(payload);
    });
});

describe('AgentsApi durable routing control command', () => {
    it('posts a bounded CAS command to the encoded subject and exact versioned status path', async () => {
        const requests: Request[] = [];
        const command: ExperimentalUpdateAgentRoutingControlPayload = {
            operation_id: 'change:to-b',
            expected_revision: 0,
            recorded_at: '2026-10-02T00:00:00.000Z',
            change: { model: 'model:b' },
        };
        const response: ExperimentalAgentRoutingControlResponse = {
            api_version: '=20260930',
            routing_control: {
                version: 2,
                kind: 'change',
                owner: {
                    account_id: 'account:1',
                    project_id: 'project:1',
                    subject_agent_run_id: 'subject:1',
                    owner_agent_run_id: 'subject:1',
                    scope: 'root',
                    namespace_origin_first_run_id: 'chain:1',
                },
                origin_execution: { workflow_id: 'workflow:1', first_run_id: 'chain:1' },
                operation_id: command.operation_id,
                recorded_at: command.recorded_at,
                payload_fingerprint: 'fingerprint:command',
                base_revision: 0,
                result_revision: 1,
                previous_receipt_id: 'seed:initial',
                change: command.change,
                intent: { model: 'model:b' },
            },
        };
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'existing-owner-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json(response);
            }) as typeof fetch,
        });
        const controller = new AbortController();
        await expect(
            client.agents.updateRoutingControl('subject/with slash', command, {
                signal: controller.signal,
                headers: { 'x-trace': 'routing' },
            }),
        ).resolves.toEqual(response);
        const request = requests[0];
        expect(new URL(request.url).pathname).toBe('/api/v1/agents/subject%2Fwith%20slash/status');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(request.headers.get('x-trace')).toBe('routing');
        expect(await request.json()).toEqual(command);
        controller.abort();
        expect(request.signal.aborted).toBe(true);
    });
    it('keeps the existing lifecycle status call on the unversioned request path', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'existing-owner-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json({ id: 'subject:1', status: 'running' });
            }) as typeof fetch,
        });
        await client.agents.updateStatus('subject:1', { title: 'Legacy lifecycle' });
        const request = requests[0];
        expect(new URL(request.url).pathname).toBe('/api/v1/agents/subject:1/status');
        expect(request.headers.get('x-api-version')).not.toBe('=20260930');
        expect(await request.json()).toEqual({ title: 'Legacy lifecycle' });
    });
});
