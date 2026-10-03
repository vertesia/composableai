import { createConversationDocument } from '@llumiverse/conversation';
import type { ExperimentalCanonicalToolCatalogSelectionHeadPayload } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

describe('guarded catalog exact-version SDK', () => {
    it('retains exact tools evidence, owner scope, version and cancellation on the existing head PUT', async () => {
        const requests: Request[] = [];
        const head = { conversation_id: 'conversation:catalog', revision: 3 };
        const payload = {
            kind: 'tool_catalog_selection',
            request: {
                run: { id: 'execution:catalog', account: 'account:catalog', project: 'project:catalog' },
                asyncCompletion: {
                    run_id: 'run:catalog',
                    activity_id: 'activity:catalog',
                    task_token: 'opaque:catalog',
                    canonical_state: { head: { ...head, revision: 2 }, scope: 'workstream:launch' },
                    agent_acceptance: {
                        version: 1,
                        subject_agent_run_id: 'subject:catalog',
                        scope: 'workstream:launch',
                        activity_id: 'activity:catalog',
                        workstream_id: 'node:catalog',
                    },
                    canonical_output_reference: 'conversation_output_authority_v1',
                },
                continuation_anchor: {
                    kind: 'materialized_tool_input',
                    materialized_input: { operation_id: 'input:catalog', result_revision: 2 },
                },
            },
        } satisfies ExperimentalCanonicalToolCatalogSelectionHeadPayload;
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'existing-workflow-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                requests.push(request);
                return Response.json(head);
            }) as typeof fetch,
        });
        const controller = new AbortController();
        await expect(
            client.agents.publishCanonicalToolCatalogSelection('owner/one', payload, 'workstream:launch', {
                signal: controller.signal,
                timeoutMs: 3000,
                headers: { 'x-test-owned': 'catalog' },
            }),
        ).resolves.toEqual(head);
        expect(requests).toHaveLength(1);
        const request = requests[0];
        expect(request.method).toBe('PUT');
        expect(new URL(request.url).pathname).toBe('/api/v1/agents/owner%2Fone/conversation/head');
        expect(new URL(request.url).searchParams.get('conversation_scope')).toBe('workstream:launch');
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(request.headers.get('x-test-owned')).toBe('catalog');
        expect(request.headers.get('authorization')).toBe('Bearer existing-workflow-token');
        await expect(request.json()).resolves.toEqual(payload);
        controller.abort();
        expect(request.signal.aborted).toBe(true);
    });
    it('carries cancellation to the exact immutable revision read without changing its default request', async () => {
        const requests: Request[] = [];
        const document = createConversationDocument({ id: 'conversation:catalog', created_at: '2026-10-04T00:00:00Z' });
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'existing-workflow-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json(document);
            }) as typeof fetch,
        });
        const controller = new AbortController();
        await expect(
            client.agents.getConversationHead(
                'owner/one',
                { conversation_id: document.id, revision: 0 },
                'workstream:launch',
                {
                    signal: controller.signal,
                    timeoutMs: 3000,
                },
            ),
        ).resolves.toEqual(document);
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('GET');
        expect(new URL(requests[0].url).pathname).toBe(
            '/api/v1/agents/owner%2Fone/conversation/conversation%3Acatalog/revisions/0',
        );
        expect(new URL(requests[0].url).searchParams.get('conversation_scope')).toBe('workstream:launch');
        expect(requests[0].headers.get('authorization')).toBe('Bearer existing-workflow-token');
        controller.abort();
        expect(requests[0].signal.aborted).toBe(true);
    });
});
