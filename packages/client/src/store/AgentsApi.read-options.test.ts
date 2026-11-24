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

    it('still accepts the read methods as one-argument callbacks, such as Array.map', async () => {
        const { client, requests } = recordingClient();
        const ids = ['a', 'b'];

        // These compiled before the read methods took options; `typecheck:test` keeps them compiling.
        // Array.map passes (value, index, array): the index and the array must not be read as options.
        const runs = await Promise.all(ids.map(client.agents.retrieve.bind(client.agents)));
        const children = await Promise.all(ids.map(client.agents.listChildren.bind(client.agents)));
        const messages = await Promise.all(ids.map(client.agents.retrieveMessages.bind(client.agents)));

        expect(runs).toHaveLength(2);
        expect(children).toHaveLength(2);
        expect(messages).toEqual([[], []]);
        const updates = requests.map((req) => new URL(req.url)).filter((url) => url.pathname.endsWith('/updates'));
        // retrieveMessages always read its second argument as `since`; the index 0 means "no since".
        expect(updates.map((url) => url.searchParams.get('since'))).toEqual([null, '1']);
        for (const req of requests) {
            expect([...new URL(req.url).searchParams.keys()].filter((key) => key !== 'since')).toEqual([]);
        }
    });
});
