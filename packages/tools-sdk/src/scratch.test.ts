import type { AuthTokenPayload } from '@vertesia/common';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { AuthSession } from './auth.js';
import {
    createMemoryScratch,
    createSandboxScratch,
    SANDBOX_SCRATCH_ORIGIN,
    ScratchError,
    type ToolScratch,
} from './scratch.js';
import { createToolServer } from './server.js';
import { ToolCollection } from './ToolCollection.js';

/** Stand-in for the app runtime's scratch endpoint (apps/app-gateway workerd.ts), same status contract. */
function runtimeScratchFetch(quota: number): typeof fetch {
    const entries = new Map<string, { bytes: Uint8Array<ArrayBuffer>; type: string }>();
    let used = 0;
    return async (input, init) => {
        const url = new URL(String(input));
        expect(url.origin).toBe(SANDBOX_SCRATCH_ORIGIN);
        const key = decodeURIComponent(url.pathname.slice(1));
        const method = init?.method ?? 'GET';
        if (!key && method === 'GET') {
            const list = [...entries].map(([name, { bytes, type }]) => ({ key: name, size: bytes.length, type }));
            return Response.json({ used, quota, entries: list });
        }
        const entry = entries.get(key);
        if (method === 'GET') return entry ? new Response(entry.bytes) : new Response('Not found', { status: 404 });
        if (method === 'DELETE') {
            if (!entry) return new Response('Not found', { status: 404 });
            entries.delete(key);
            used -= entry.bytes.length;
            return new Response(null, { status: 204 });
        }
        const bytes = new Uint8Array(await new Response(init?.body).arrayBuffer());
        if (bytes.length > quota - used + (entry?.bytes.length ?? 0))
            return new Response('Scratch storage quota exceeded', { status: 507 });
        used += bytes.length - (entry?.bytes.length ?? 0);
        entries.set(key, { bytes, type: new Headers(init?.headers).get('content-type') ?? '' });
        return new Response(null, { status: entry ? 204 : 201 });
    };
}

describe.each([
    ['memory (Node hosts)', (quota: number) => createMemoryScratch(quota)],
    ['sandbox runtime', (quota: number) => createSandboxScratch(runtimeScratchFetch(quota))],
])('ToolScratch over %s', (_name, create: (quota: number) => ToolScratch) => {
    it('stores, replaces, reads, lists and deletes', async () => {
        const scratch = create(1024);
        await scratch.put('work/a.txt', 'hello');
        await scratch.putJson('work/b.json', { n: 1 });
        await scratch.put('bin', new Uint8Array([1, 2, 3]));
        await scratch.put('work/a.txt', 'hello again');
        expect(await scratch.getText('work/a.txt')).toBe('hello again');
        expect(await scratch.getJson('work/b.json')).toEqual({ n: 1 });
        expect(await scratch.get('bin')).toEqual(new Uint8Array([1, 2, 3]));
        expect(await scratch.get('missing')).toBeUndefined();
        expect(await scratch.list()).toEqual([
            { key: 'work/a.txt', size: 11, contentType: 'text/plain;charset=UTF-8' },
            { key: 'work/b.json', size: 7, contentType: 'application/json' },
            { key: 'bin', size: 3, contentType: 'application/octet-stream' },
        ]);
        expect(await scratch.delete('work/a.txt')).toBe(true);
        expect(await scratch.delete('work/a.txt')).toBe(false);
        expect(await scratch.getText('work/a.txt')).toBeUndefined();
    });

    it('keys with spaces, unicode and percent signs round-trip', async () => {
        const scratch = create(1024);
        for (const key of ['dir/with space.txt', 'données/été.csv', 'a%2Fb', 'q?x=1#y']) {
            await scratch.put(key, key);
            expect(await scratch.getText(key)).toBe(key);
        }
        expect((await scratch.list()).map((entry) => entry.key)).toEqual([
            'dir/with space.txt',
            'données/été.csv',
            'a%2Fb',
            'q?x=1#y',
        ]);
    });

    it('enforces the quota, counting replacements once', async () => {
        const scratch = create(10);
        await scratch.put('a', '12345678');
        await scratch.put('a', '1234567890');
        await expect(scratch.put('b', '1')).rejects.toMatchObject({ code: 'quota_exceeded' });
        await scratch.delete('a');
        await scratch.put('b', '1234567890');
    });

    it('rejects traversal and malformed keys before storage', async () => {
        const scratch = create(1024);
        for (const key of ['', '/abs', 'a/../b', './a', 'a//b', 'a/', 'back\\slash', 'nul\0']) {
            await expect(scratch.put(key, 'x')).rejects.toBeInstanceOf(ScratchError);
            await expect(scratch.get(key)).rejects.toMatchObject({ code: 'invalid_key' });
        }
        expect(await scratch.list()).toEqual([]);
    });

    it('stores a copy, not a view of the caller buffer', async () => {
        const scratch = create(1024);
        const buffer = new Uint8Array([1, 2]);
        await scratch.put('copy', buffer);
        buffer[0] = 9;
        const read = await scratch.get('copy');
        expect(read).toEqual(new Uint8Array([1, 2]));
        if (read) read[1] = 9;
        expect(await scratch.get('copy')).toEqual(new Uint8Array([1, 2]));
    });
});

describe('sandbox scratch transport', () => {
    it('reports a host without scratch storage as unavailable', async () => {
        const scratch = createSandboxScratch(async () => new Response('Scratch storage is disabled', { status: 503 }));
        await expect(scratch.get('a')).rejects.toMatchObject({ code: 'unavailable' });
        await expect(scratch.put('a', 'x')).rejects.toMatchObject({ code: 'unavailable' });
    });
});

describe('session scratch on a Node tool server', () => {
    it('gives every request its own empty store', async () => {
        const server = createToolServer({
            disableHtml: true,
            tools: [
                new ToolCollection({
                    name: 'example',
                    tools: [
                        {
                            name: 'remember',
                            description: 'Writes to scratch and reports what it sees',
                            input_schema: { type: 'object', properties: {} },
                            run: async (payload, context) => {
                                const before = (await context.scratch.list()).map((entry) => entry.key);
                                await context.scratch.put(`seen/${payload.tool_use.id}`, 'x');
                                return { is_error: false, content: JSON.stringify(before) };
                            },
                        },
                    ],
                }),
            ],
        });
        const app = new Hono();
        app.use('*', async (c, next) => {
            const claims = { account: { id: 'a' }, project: { id: 'p' }, endpoints: {} } as AuthTokenPayload;
            c.set('toolAuthSession' as never, new AuthSession('node-token', claims) as never);
            await next();
        });
        app.route('/', server);
        for (const id of ['1', '2']) {
            const response = await app.request('https://example.test/api/tools', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ tool_use: { id, tool_name: 'remember', tool_input: {} } }),
            });
            expect(await response.json()).toMatchObject({ is_error: false, content: '[]' });
        }
    });
});
