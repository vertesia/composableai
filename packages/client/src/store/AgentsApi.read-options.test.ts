import { describe, expect, it } from 'vitest';
import { VertesiaClient } from '../client.js';

describe('agent run read options', () => {
    function recordingClient() {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.test',
            storeUrl: 'https://store.test',
            fetch: (async (input: Request) => {
                requests.push(input);
                const path = new URL(input.url).pathname;
                if (path.endsWith('/updates')) return Response.json({ messages: [] });
                if (path.endsWith('/children')) return Response.json({ runs: [] });
                return Response.json({ id: 'agent' });
            }) as typeof fetch,
        });
        return { client, requests };
    }

    it('sends the caller signal and headers on retrieve, retrieveMessages and listChildren', async () => {
        const { client, requests } = recordingClient();
        const controller = new AbortController();
        const options = { signal: controller.signal, headers: { 'x-test': 'yes' } };

        await client.agents.retrieve('agent', options);
        await client.agents.retrieveMessages('agent', 42, options);
        await client.agents.listChildren('agent', options);

        expect(requests.map((req) => new URL(req.url).pathname)).toEqual([
            '/api/v1/agents/agent',
            '/api/v1/agents/agent/updates',
            '/api/v1/agents/agent/children',
        ]);
        expect(new URL(requests[1].url).searchParams.get('since')).toBe('42');
        for (const req of requests) {
            expect(req.headers.get('x-test')).toBe('yes');
            expect(req.signal.aborted).toBe(false);
        }
        controller.abort();
        for (const req of requests) {
            expect(req.signal.aborted).toBe(true);
        }
    });
});
