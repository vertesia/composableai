import { describe, expect, it } from 'vitest';
import { VertesiaClient } from '../client.js';

describe('agent history cursor transport', () => {
    it('passes the cursor and response metadata through for main and child details', async () => {
        const urls: URL[] = [];
        const response = { history: { type: 'agent', mode: 'delta', next_from: 'next', agentTasks: [] } };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.test',
            storeUrl: 'https://store.test',
            fetch: (async (input: Request | string) => {
                urls.push(new URL(typeof input === 'string' ? input : input.url));
                return Response.json(response);
            }) as typeof fetch,
        });
        const options = { includeHistory: true, hydratePayloads: true, from: 'opaque/+=' };
        expect(await client.agents.getRunDetails('agent', options)).toEqual(response);
        expect(await client.agents.getChildDetails('agent', 'child', options)).toEqual(response);
        expect(urls.map((url) => url.pathname)).toEqual([
            '/api/v1/agents/agent/details',
            '/api/v1/agents/agent/children/child/details',
        ]);
        for (const url of urls) {
            expect(url.searchParams.get('from')).toBe(options.from);
            expect(url.searchParams.get('include_history')).toBe('true');
            expect(url.searchParams.get('hydrate_payloads')).toBe('true');
        }
    });
});
