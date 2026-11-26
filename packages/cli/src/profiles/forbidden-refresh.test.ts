import { describe, expect, it, vi } from 'vitest';
import { createRefreshOnForbiddenFetch } from './forbidden-refresh.js';
import type { Profile } from './index.js';

const profile = {
    name: 'test',
    studio_server_url: 'http://studio.test',
    zeno_server_url: 'http://store.test',
} as Profile;
const auth = { headers: { authorization: 'Bearer stale' } };

function response(status: number): Response {
    return new Response(status === 200 ? '{}' : 'forbidden', { status });
}

function setup(statuses: number[], refreshResult: unknown = { token: 'fresh' }) {
    const seen: string[] = [];
    const baseFetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const request = new Request(input, init);
        seen.push(request.headers.get('authorization') ?? '');
        return response(statuses[seen.length - 1]);
    });
    const refresh = vi.fn(async () => refreshResult);
    const authProvider = vi.fn(async () => 'Bearer fresh');
    const fetch = createRefreshOnForbiddenFetch(profile, authProvider, baseFetch, refresh);
    return { fetch, baseFetch, refresh, authProvider, seen };
}

describe('createRefreshOnForbiddenFetch', () => {
    it('refreshes once and retries with the new token when the first answer is 403', async () => {
        const { fetch, refresh, seen } = setup([403, 200]);

        const res = await fetch(
            new Request('http://studio.test/api/v1/apps/installations/name/app', {
                headers: { authorization: 'Bearer stale' },
            }),
        );

        expect(res.status).toBe(200);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(seen).toEqual(['Bearer stale', 'Bearer fresh']);
    });

    it('returns the second 403 unchanged and does not refresh again', async () => {
        const { fetch, refresh, baseFetch } = setup([403, 403, 403]);

        const first = await fetch(new Request('http://studio.test/a', auth));
        // Requests after the refresh carry the fresh token, which the server still refuses.
        const second = await fetch(new Request('http://studio.test/b', { headers: { authorization: 'Bearer fresh' } }));

        expect(first.status).toBe(403);
        expect(second.status).toBe(403);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(baseFetch).toHaveBeenCalledTimes(3);
    });

    it('keeps the 403 when no refresh is possible', async () => {
        const { fetch, baseFetch } = setup([403], null);

        const res = await fetch(new Request('http://studio.test/a', auth));

        expect(res.status).toBe(403);
        expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it('passes other statuses through without refreshing', async () => {
        const { fetch, refresh, baseFetch } = setup([404]);

        const res = await fetch(new Request('http://studio.test/a', auth));

        expect(res.status).toBe(404);
        expect(refresh).not.toHaveBeenCalled();
        expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it('resends a request body on the retry', async () => {
        const bodies: string[] = [];
        const baseFetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
            const request = new Request(input, init);
            bodies.push(await request.text());
            return response(bodies.length === 1 ? 403 : 200);
        });
        const fetch = createRefreshOnForbiddenFetch(
            profile,
            async () => 'Bearer fresh',
            baseFetch,
            async () => ({}),
        );

        const res = await fetch(
            new Request('http://studio.test/a', {
                method: 'POST',
                headers: { ...auth.headers, 'content-type': 'application/json' },
                body: '{"x":1}',
            }),
        );

        expect(res.status).toBe(200);
        expect(bodies).toEqual(['{"x":1}', '{"x":1}']);
    });

    it('never resends to a host that is not one of the profile servers', async () => {
        const { fetch, refresh, baseFetch } = setup([403]);

        const res = await fetch(new Request('https://storage.example.test/upload', auth));

        expect(res.status).toBe(403);
        expect(refresh).not.toHaveBeenCalled();
        expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it('never adds a token to a request that did not carry one', async () => {
        const { fetch, refresh, seen } = setup([403]);

        await fetch(new Request('http://store.test/public'));

        expect(refresh).not.toHaveBeenCalled();
        expect(seen).toEqual(['']);
    });

    it('never resends a streamed upload, so it is not held in memory', async () => {
        const { fetch, refresh, baseFetch } = setup([403]);

        const res = await fetch(
            new Request('http://store.test/upload', {
                method: 'PUT',
                headers: { ...auth.headers, 'content-type': 'application/octet-stream' },
                body: new Blob(['bytes']),
            }),
        );

        expect(res.status).toBe(403);
        expect(refresh).not.toHaveBeenCalled();
        expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it('shares one refresh between requests refused at the same time', async () => {
        const baseFetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
            const request = new Request(input, init);
            return response(request.headers.get('authorization') === 'Bearer fresh' ? 200 : 403);
        });
        const refresh = vi.fn(async () => ({}));
        const fetch = createRefreshOnForbiddenFetch(profile, async () => 'Bearer fresh', baseFetch, refresh);

        const results = await Promise.all([
            fetch(new Request('http://studio.test/a', auth)),
            fetch(new Request('http://studio.test/b', auth)),
        ]);

        expect(results.map((res) => res.status)).toEqual([200, 200]);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('does not resend a request that already carried the fresh token', async () => {
        const { fetch, baseFetch } = setup([403, 403]);

        await fetch(new Request('http://studio.test/a', auth));
        await fetch(new Request('http://studio.test/b', { headers: { authorization: 'Bearer fresh' } }));

        expect(baseFetch).toHaveBeenCalledTimes(3);
    });
});
