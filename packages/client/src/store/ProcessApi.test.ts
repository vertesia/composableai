import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

function createClient(requests: Request[]) {
    return new ZenoClient({
        serverUrl: 'https://zeno.example.com',
        fetch: vi.fn(async () => Response.json([])),
        onRequest: (request) => requests.push(request),
    });
}

describe('ProcessApi.list', () => {
    it.each([
        ['canonical', { all_versions: true }],
        ['deprecated', { allVersions: true }],
    ])('maps the %s all-versions option to the wire query', async (_name, query) => {
        const requests: Request[] = [];
        const client = createClient(requests);

        await client.processes.list(query);

        expect(requests[0]?.url).toBe('https://zeno.example.com/api/v1/processes?all_versions=true');
    });
});
