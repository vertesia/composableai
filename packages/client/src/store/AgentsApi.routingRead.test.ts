import type { ExperimentalAgentRoutingControlResponse } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

describe('AgentsApi immutable routing read', () => {
    it.each([undefined, 'prior:operation'])(
        'reads the current or retained %s receipt without delivery input',
        async (operationId) => {
            const requests: Request[] = [];
            const response: ExperimentalAgentRoutingControlResponse = {
                api_version: '=20260930',
                routing_control: {
                    version: 2,
                    kind: 'initial',
                    owner: {
                        account_id: 'account',
                        project_id: 'project',
                        subject_agent_run_id: 'subject',
                        owner_agent_run_id: 'subject',
                        scope: 'root',
                        namespace_origin_first_run_id: 'origin:chain',
                    },
                    origin_execution: { workflow_id: 'origin:workflow', first_run_id: 'origin:chain' },
                    operation_id: 'seed:operation',
                    recorded_at: '2026-10-02T00:00:00.000Z',
                    payload_fingerprint: 'fingerprint:seed',
                    base_revision: 0,
                    result_revision: 0,
                    intent: { model: 'model:one' },
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
                client.agents.getRoutingControl('subject/one', operationId, {
                    signal: controller.signal,
                    headers: { 'x-trace': 'read-control' },
                }),
            ).resolves.toEqual(response);
            const request = requests[0];
            const url = new URL(request.url);
            expect(url.pathname).toBe('/api/v1/agents/subject%2Fone');
            expect(url.searchParams.get('access')).toBe('control');
            expect(url.searchParams.get('routing_control_operation_id')).toBe(operationId ?? null);
            expect(request.method).toBe('GET');
            expect(request.headers.get('x-api-version')).toBe('=20260930');
            expect(request.headers.get('x-trace')).toBe('read-control');
            expect(request.body).toBeNull();
            controller.abort();
            expect(request.signal.aborted).toBe(true);
        },
    );
});
