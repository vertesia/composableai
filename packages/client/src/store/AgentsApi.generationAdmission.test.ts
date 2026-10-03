import type {
    ExperimentalAdmitAgentGenerationPayload,
    ExperimentalAgentGenerationAdmissionReceipt,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

describe('AgentsApi pending generation admission', () => {
    it('forwards the exact scheduled request and existing authorization through the exact-version dedicated route', async () => {
        const requests: Request[] = [];
        const payload = {
            operation: 'user',
            request: {
                run: { id: 'execution', account: 'account', project: 'project' },
                input_append: {
                    expected_revision: 0,
                    operation_id: 'user:1',
                    recorded_at: '2026-10-02T00:00:00.000Z',
                    records: {
                        turns: [
                            {
                                id: 'user:1',
                                kind: 'user',
                                authority: 'ordinary',
                                model_visibility: 'include',
                                status: 'completed',
                                timestamps: { recorded_at: '2026-10-02T00:00:00.000Z' },
                                provenance: { type: 'received' },
                                blocks: [
                                    { id: 'text:1', type: 'text', text: 'Already hydrated input.', format: 'plain' },
                                ],
                            },
                        ],
                    },
                },
                asyncCompletion: {
                    task_token: 'actual-opaque-token',
                    run_id: 'actual-temporal-run',
                    activity_id: 'native:1',
                    canonical_state: { head: { conversation_id: 'conversation', revision: 0 }, scope: 'root' },
                    canonical_output_reference: 'conversation_output_authority_v1',
                    agent_acceptance: {
                        version: 1,
                        subject_agent_run_id: 'subject',
                        activity_id: 'native:1',
                        scope: 'root',
                    },
                },
            },
        } satisfies ExperimentalAdmitAgentGenerationPayload;
        const response = {
            version: 1,
            request_id: 'activity:actual-temporal-run:native%3A1',
            input_fingerprint: 'sha256:synthetic-input',
            admitted_at: '2026-10-02T00:00:00.000Z',
            execution: { workflow_id: 'actual-workflow', chain_first_run_id: 'actual-chain-first' },
            routing_control: {
                version: 2,
                kind: 'initial',
                operation_id: 'routing:initial',
                recorded_at: '2026-10-02T00:00:00.000Z',
                payload_fingerprint: 'sha256:synthetic-route',
                base_revision: 0,
                result_revision: 0,
                intent: { model: 'model:A' },
                origin_execution: { workflow_id: 'actual-workflow', first_run_id: 'actual-chain-first' },
                owner: {
                    account_id: 'account',
                    project_id: 'project',
                    subject_agent_run_id: 'subject',
                    owner_agent_run_id: 'subject',
                    scope: 'root',
                    namespace_origin_first_run_id: 'actual-chain-first',
                },
            },
        } satisfies ExperimentalAgentGenerationAdmissionReceipt;
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
            client.agents.admitGeneration('subject/one', payload, {
                headers: { 'x-trace': 'pending-generation' },
                signal: controller.signal,
                timeoutMs: 5000,
            }),
        ).resolves.toEqual(response);
        expect(requests).toHaveLength(1);
        const request = requests[0];
        expect(new URL(request.url).pathname).toBe('/api/v1/agents/subject%2Fone/generation-admission');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(request.headers.get('x-trace')).toBe('pending-generation');
        expect(request.headers.get('authorization')).toBe('Bearer existing-owner-token');
        await expect(request.json()).resolves.toEqual(payload);
        controller.abort();
        expect(request.signal.aborted).toBe(true);
    });
});
