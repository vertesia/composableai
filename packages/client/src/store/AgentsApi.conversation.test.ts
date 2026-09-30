import type { ConversationDocumentV0 } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

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
});
