import type { ExperimentalAgentConversationSourceDescriptor } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

const descriptor: ExperimentalAgentConversationSourceDescriptor = {
    api_version: '=20260930',
    agent_run_id: 'child/run',
    scope: 'workstream:launch-1',
    workstream_id: 'node-1',
    status: 'initialized',
    contract_version: 'canonical-conversation-v1',
    head: {
        format: 'llumiverse.conversation',
        schema_version: 0,
        experimental_revision: '2026-09-30.adoption.1',
        conversation_id: 'conversation:child',
        revision: 4,
    },
};

describe('AgentsApi canonical conversation source', () => {
    it('sends the exact scope and experimental version header', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                requests.push(request);
                return Response.json(descriptor);
            }) as typeof fetch,
        });

        await expect(
            client.agents.getConversationSource(
                'child/run',
                { conversation_scope: 'workstream:launch-1', workstream_id: 'node-1' },
                { headers: { 'x-trace': 'source-descriptor' } },
            ),
        ).resolves.toEqual(descriptor);

        const request = requests[0];
        const url = new URL(request.url);
        expect(url.pathname).toBe('/api/v1/agents/child%2Frun/conversation/source');
        expect(Object.fromEntries(url.searchParams)).toEqual({
            conversation_scope: 'workstream:launch-1',
            workstream_id: 'node-1',
        });
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(request.headers.get('x-trace')).toBe('source-descriptor');
    });

    it('preserves an explicit uninitialized result for a root scope request', async () => {
        const urls: URL[] = [];
        const uninitialized: ExperimentalAgentConversationSourceDescriptor = {
            api_version: '=20260930',
            agent_run_id: 'agent',
            scope: 'root',
            status: 'uninitialized',
        };
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string) => {
                urls.push(new URL(typeof input === 'string' ? input : input.url));
                return Response.json(uninitialized);
            }) as typeof fetch,
        });

        await expect(client.agents.getConversationSource('agent')).resolves.toEqual(uninitialized);
        expect(urls[0].search).toBe('');
    });
});
