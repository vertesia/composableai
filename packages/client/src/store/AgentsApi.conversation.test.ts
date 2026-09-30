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
});
