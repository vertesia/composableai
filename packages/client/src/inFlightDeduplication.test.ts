import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

function jsonResponse(payload: unknown) {
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('VertesiaClient in-flight deduplication', () => {
    it('is on by default, with one table shared by the studio and store clients', async () => {
        const fetchMock = vi.fn(async (input: Request | string | URL) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            return jsonResponse({ url });
        });
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://store.example.com',
            fetch: fetchMock,
        });

        expect(client.getInFlightRequests()).toBeDefined();
        expect(client.store.getInFlightRequests()).toBe(client.getInFlightRequests());

        const [a, b] = await Promise.all([client.projects.retrieve('p1'), client.projects.retrieve('p1')]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(a).toEqual(b);
        expect(a).not.toBe(b);
    });

    it('can be turned off', async () => {
        const fetchMock = vi.fn(async () => jsonResponse({}));
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://store.example.com',
            fetch: fetchMock,
            inFlightDeduplication: false,
        });

        expect(client.getInFlightRequests()).toBeUndefined();
        expect(client.store.getInFlightRequests()).toBeUndefined();

        await Promise.all([client.projects.retrieve('p1'), client.projects.retrieve('p1')]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('shares the table with the OAuth server API, so a write through the main client invalidates its GETs', async () => {
        const answers: Array<() => void> = [];
        const fetchMock = vi.fn(
            (input: Request | string | URL) =>
                new Promise<Response>((resolve) => {
                    const req = input as Request;
                    answers.push(() => resolve(jsonResponse({ method: req.method })));
                }),
        );
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://store.example.com',
            fetch: fetchMock,
        });
        expect(client.oauthServer.getInFlightRequests()).toBe(client.getInFlightRequests());

        const before = client.oauthServer.get('/clients/c1');
        const write = client.projects.update('p1', { name: 'renamed' });
        const after = client.oauthServer.get('/clients/c1');
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
        const methods = fetchMock.mock.calls.map(([input]) => (input as Request).method);
        expect(methods.filter((m) => m === 'GET')).toHaveLength(2);
        for (const answer of answers) answer();
        await Promise.all([before, write, after]);
    });
});
