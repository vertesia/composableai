import { createConversationDocument } from '@llumiverse/conversation';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

describe('immutable canonical source SDK reads', () => {
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
