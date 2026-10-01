import {
    appendConversationRecords,
    createAcceptedOutputFragment,
    createConversationDocument,
    type Generation,
} from '@llumiverse/conversation';
import {
    type ConversationDocumentV0,
    type ConversationOutputReceipt,
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

const recordedAt = '2026-10-01T00:00:00.000Z';

function acceptedOutput() {
    const initial = createConversationDocument({ id: 'conversation:accepted', created_at: recordedAt });
    const generation = {
        id: 'generation:accepted',
        record_source: 'executed' as const,
        request_id: 'request:accepted',
        attempt_id: 'attempt:accepted',
        purpose: 'interaction',
        requested_model: 'test-model',
        provider: 'test-provider',
        protocol: 'test-protocol',
        adapter_version: 'test-adapter',
        status: 'completed' as const,
        finish_reason: 'stop',
        timestamps: { recorded_at: recordedAt, completed_at: recordedAt },
        source: { conversation_id: initial.id, revision: initial.revision },
        request_receipt: {
            id: 'request-receipt:accepted',
            request_id: 'request:accepted',
            attempt_id: 'attempt:accepted',
            source: { conversation_id: initial.id, revision: initial.revision },
            context_fingerprint: 'context-fingerprint',
            tool_set_fingerprint: 'tool-set-fingerprint',
            request_fingerprint: 'request-fingerprint',
            target: {
                provider: 'test-provider',
                protocol: 'test-protocol',
                model: 'test-model',
                adapter_version: 'test-adapter',
            },
            tool_definition_ids: [],
            asset_versions: [],
            item_mappings: [],
            recorded_at: recordedAt,
        },
    } satisfies Generation;
    const document = appendConversationRecords(
        initial,
        {
            turns: [
                {
                    id: 'turn:accepted',
                    kind: 'agent',
                    authority: 'ordinary',
                    status: 'completed',
                    timestamps: { recorded_at: recordedAt, completed_at: recordedAt },
                    model_visibility: 'include',
                    provenance: { type: 'generated' },
                    generation_id: generation.id,
                    blocks: [{ id: 'block:text', type: 'text', text: 'accepted answer', format: 'plain' }],
                },
            ],
            generations: [generation],
        },
        {
            expected_revision: initial.revision,
            operation_id: 'response:accepted',
            payload_fingerprint: 'response-fingerprint',
            recorded_at: recordedAt,
        },
    ).document;
    return createAcceptedOutputFragment(document, 'response:accepted');
}

describe('AgentsApi canonical conversation transport', () => {
    it('discovers the scoped head without requiring a compatibility-projection conversation id', async () => {
        const urls: URL[] = [];
        const document = { id: 'conversation:source', revision: 4 } as ConversationDocumentV0;
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string) => {
                urls.push(new URL(typeof input === 'string' ? input : input.url));
                return Response.json(document);
            }) as typeof fetch,
        });

        await expect(
            client.agents.discoverCurrentConversationHead('run/with delimiter', 'workstream:launch-1'),
        ).resolves.toEqual(document);
        expect(urls).toHaveLength(1);
        expect(urls[0].pathname).toBe('/api/v1/agents/run%2Fwith%20delimiter/conversation/head');
        expect(urls[0].searchParams.get('conversation_scope')).toBe('workstream:launch-1');
    });

    it('appends a scoped controller program turn with the exact bounded intent payload', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                requests.push(request);
                return Response.json({
                    conversation: { conversation_id: 'conversation:1', revision: 5 },
                    operation_receipt: {
                        id: 'controller-corrective:1',
                        base_revision: 4,
                        result_revision: 5,
                        payload_fingerprint: `sha256:${'a'.repeat(64)}`,
                        recorded_at: '2026-09-30T00:00:00.000Z',
                    },
                    applied: true,
                });
            }) as typeof fetch,
        });
        const payload = {
            conversation_id: 'conversation:1',
            expected_revision: 4,
            operation_id: 'controller-corrective:1',
            recorded_at: '2026-09-30T00:00:00.000Z',
            purpose: 'controller_corrective' as const,
            text: 'Use a different tool before answering.',
        };

        await client.agents.appendConversationProgramTurn('run/with delimiter', payload, 'workstream:launch-1');

        expect(requests).toHaveLength(1);
        expect(new URL(requests[0].url).pathname).toBe(
            '/api/v1/agents/run%2Fwith%20delimiter/conversation/program-turns',
        );
        expect(new URL(requests[0].url).searchParams.get('conversation_scope')).toBe('workstream:launch-1');
        await expect(requests[0].json()).resolves.toEqual(payload);
    });

    it('loads exact accepted output with the experimental header and verifies the full receipt', async () => {
        const requests: Request[] = [];
        const fragment = acceptedOutput();
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                requests.push(request);
                return Response.json({ status: 'accepted', fragment });
            }) as typeof fetch,
        });

        const output = await client.agents.retrieveConversationAcceptedOutput(
            'run/with delimiter',
            fragment.receipt,
            'workstream:launch-1',
            { headers: { 'X-Api-Version': '=1', 'x-trace': 'accepted-output' } },
        );

        expect(output.text()).toBe('accepted answer');
        expect(requests).toHaveLength(1);
        const request = requests[0];
        const url = new URL(request.url);
        expect(url.pathname).toBe(
            '/api/v1/agents/run%2Fwith%20delimiter/conversation/conversation%3Aaccepted/' +
                'revisions/1/accepted-output/response%3Aaccepted',
        );
        expect(url.searchParams.get('conversation_scope')).toBe('workstream:launch-1');
        expect(request.headers.get('x-api-version')).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
        expect(request.headers.get('x-trace')).toBe('accepted-output');
    });

    it('rejects a valid fragment whose complete receipt differs from the expected receipt', async () => {
        const fragment = acceptedOutput();
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async () => Response.json({ status: 'accepted', fragment })) as typeof fetch,
        });
        const mismatched = {
            ...fragment.receipt,
            recorded_at: '2026-10-01T00:00:01.000Z',
        } satisfies ConversationOutputReceipt;

        await expect(client.agents.retrieveConversationAcceptedOutput('run-1', mismatched)).rejects.toThrow(
            'Canonical accepted output receipt does not match the requested receipt',
        );
    });

    it('snapshots the expected receipt before awaiting transport', async () => {
        const fragment = acceptedOutput();
        let releaseResponse: () => void = () => {};
        const responseReady = new Promise<void>((resolve) => {
            releaseResponse = resolve;
        });
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async () => {
                await responseReady;
                return Response.json({ status: 'accepted', fragment });
            }) as typeof fetch,
        });
        const expected = structuredClone(fragment.receipt);

        const pending = client.agents.retrieveConversationAcceptedOutput('run-1', expected);
        expected.recorded_at = '2026-10-01T00:00:01.000Z';
        releaseResponse();

        await expect(pending).resolves.toMatchObject({ fragment: { receipt: fragment.receipt } });
    });

    it('lists a page of accepted-output references pinned to an exact snapshot', async () => {
        const requests: Request[] = [];
        const fragment = acceptedOutput();
        const page = {
            api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
            agent_run_id: 'run/with delimiter',
            scope: 'workstream:launch-1',
            workstream_id: 'node-1',
            snapshot: { conversation_id: fragment.receipt.conversation_id, revision: 4 },
            items: [
                {
                    api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
                    agent_run_id: 'run/with delimiter',
                    scope: 'workstream:launch-1',
                    workstream_id: 'node-1',
                    type: 'accepted_output',
                    source: fragment.source,
                    receipt: fragment.receipt,
                },
            ],
        } as const;
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                requests.push(request);
                return Response.json(page);
            }) as typeof fetch,
        });

        await expect(
            client.agents.listConversationAcceptedOutputs(
                'run/with delimiter',
                {
                    conversation_scope: 'workstream:launch-1',
                    workstream_id: 'node-1',
                    snapshot_conversation_id: fragment.receipt.conversation_id,
                    snapshot_revision: 4,
                    after_revision: 1,
                    limit: 50,
                },
                { headers: { 'x-trace': 'accepted-output-history' } },
            ),
        ).resolves.toEqual(page);

        expect(requests).toHaveLength(1);
        const request = requests[0];
        const url = new URL(request.url);
        expect(url.pathname).toBe('/api/v1/agents/run%2Fwith%20delimiter/conversation/accepted-outputs');
        expect(Object.fromEntries(url.searchParams)).toEqual({
            conversation_scope: 'workstream:launch-1',
            workstream_id: 'node-1',
            snapshot_conversation_id: fragment.receipt.conversation_id,
            snapshot_revision: '4',
            after_revision: '1',
            limit: '50',
        });
        expect(request.headers.get('x-api-version')).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
        expect(request.headers.get('x-trace')).toBe('accepted-output-history');
    });

    it('omits unknown child scope and snapshot selection on the first history page', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                requests.push(request);
                return Response.json({
                    api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
                    agent_run_id: 'child-run',
                    scope: 'workstream:child-launch',
                    workstream_id: 'child-node',
                    snapshot: { conversation_id: 'conversation:child', revision: 0 },
                    items: [],
                });
            }) as typeof fetch,
        });

        await client.agents.listConversationAcceptedOutputs('child-run');

        const url = new URL(requests[0].url);
        expect([...url.searchParams]).toEqual([]);
    });

    it('streams typed live resets and reconciles accepted output through the exact receipt endpoint', async () => {
        const fragment = acceptedOutput();
        const abort = new AbortController();
        const requests: Request[] = [];
        const envelopes = [
            {
                api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
                agent_run_id: 'run/with delimiter',
                scope: 'workstream:launch-1',
                workstream_id: 'launch-1',
                type: 'preview_unavailable',
                reason: 'live_only',
            },
            {
                api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
                agent_run_id: 'run/with delimiter',
                scope: 'workstream:launch-1',
                workstream_id: 'launch-1',
                type: 'accepted_output',
                source: {
                    conversation_id: fragment.receipt.conversation_id,
                    revision: fragment.receipt.result_revision,
                },
                receipt: fragment.receipt,
            },
        ];
        const body = envelopes.map((envelope) => `data: ${JSON.stringify(envelope)}\n\n`).join('');
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                requests.push(request.clone());
                if (new URL(request.url).pathname.endsWith('/conversation/stream')) {
                    return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
                }
                return Response.json({ status: 'accepted', fragment });
            }) as typeof fetch,
        });
        const updates: string[] = [];

        await client.agents.streamCanonicalConversation(
            'run/with delimiter',
            (update) => {
                updates.push(update.type);
                if (update.type === 'accepted_output') {
                    expect(update.output.text()).toBe('accepted answer');
                    abort.abort();
                }
            },
            {
                scope: 'workstream:launch-1',
                workstream_id: 'launch-1',
                signal: abort.signal,
                max_reconnects: 0,
                headers: { 'x-api-version': '=1', 'x-trace': 'agent-canonical-stream' },
            },
        );

        expect(updates).toEqual(['preview_unavailable', 'accepted_output']);
        expect(requests).toHaveLength(2);
        const streamUrl = new URL(requests[0].url);
        expect(streamUrl.pathname).toBe('/api/v1/agents/run%2Fwith%20delimiter/conversation/stream');
        expect(streamUrl.searchParams.get('conversation_scope')).toBe('workstream:launch-1');
        expect(streamUrl.searchParams.get('workstream_id')).toBe('launch-1');
        expect(requests[0].headers.get('x-api-version')).toBe(
            EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
        );
        expect(requests[0].headers.get('x-trace')).toBe('agent-canonical-stream');
        expect(new URL(requests[1].url).pathname).toContain('/accepted-output/response%3Aaccepted');
    });

    it('omits an unknown scope and pins the authorized child scope from the stream', async () => {
        const abort = new AbortController();
        const requests: Request[] = [];
        const body = `data: ${JSON.stringify({
            api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
            agent_run_id: 'child-run',
            scope: 'workstream:child-launch-1',
            workstream_id: 'child-node',
            type: 'preview_unavailable',
            reason: 'live_only',
        })}\n\n`;
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                requests.push(request.clone());
                return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
            }) as typeof fetch,
        });

        await client.agents.streamCanonicalConversation(
            'child-run',
            (update) => {
                expect(update).toMatchObject({
                    type: 'preview_unavailable',
                    scope: 'workstream:child-launch-1',
                    workstream_id: 'child-node',
                });
                abort.abort();
            },
            { signal: abort.signal, max_reconnects: 0 },
        );

        const url = new URL(requests[0].url);
        expect(url.searchParams.has('conversation_scope')).toBe(false);
        expect(url.searchParams.has('workstream_id')).toBe(false);
    });

    it('rejects a non-accepted response envelope', async () => {
        const fragment = acceptedOutput();
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async () =>
                Response.json({ status: 'unavailable', reason: 'no_accepted_response' })) as typeof fetch,
        });

        await expect(client.agents.retrieveConversationAcceptedOutput('run-1', fragment.receipt)).rejects.toThrow(
            'Canonical accepted output endpoint returned unavailable output',
        );
    });
});
