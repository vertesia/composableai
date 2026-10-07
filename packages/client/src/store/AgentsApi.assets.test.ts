import { describe, expect, test } from 'vitest';
import { ZenoClient } from './client.js';

describe('canonical asset publication SDK', () => {
    test('uses exact version, encoded selectors and caller cancellation without claimed asset identity', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'existing-owner-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json({ publication: 'server-owned' });
            }) as typeof fetch,
        });
        const controller = new AbortController();
        const options = { signal: controller.signal, headers: { 'x-trace': 'asset' } };
        const payload = { operation_id: 'upload:one', artifact_path: 'files/my image.png' };
        await client.agents.publishAsset('subject/one', payload, options);
        await client.agents.getAsset('subject/one', 'upload/one', options);
        expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
            '/api/v1/agents/subject%2Fone/assets',
            '/api/v1/agents/subject%2Fone/assets/upload%2Fone',
        ]);
        expect(requests[0].method).toBe('POST');
        expect(await requests[0].json()).toEqual(payload);
        expect(requests[1].method).toBe('GET');
        for (const request of requests) {
            expect(request.headers.get('x-api-version')).toBe('=20260930');
            expect(request.headers.get('x-trace')).toBe('asset');
        }
        controller.abort();
        expect(requests.every((request) => request.signal.aborted)).toBe(true);
    });
    test('downloads bytes only through the scoped publication selector', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'owner',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return new Response('verified bytes');
            }) as typeof fetch,
        });
        const stream = await client.agents.downloadAsset('subject', 'upload:one');
        expect(await new Response(stream).text()).toBe('verified bytes');
        expect(new URL(requests[0].url).pathname).toBe('/api/v1/agents/subject/assets/upload%3Aone/content');
        expect(requests[0].headers.get('x-api-version')).toBe('=20260930');
    });
});
