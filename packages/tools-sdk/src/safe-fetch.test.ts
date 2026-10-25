import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
// Answer DNS from a table instead of the network.
vi.mock('node:dns', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:dns')>();
    return { ...actual, lookup, default: { ...actual, lookup } };
});

import { isPublicAddress, SafeFetchError, safeFetch, UnsafeUrlError } from './safe-fetch.js';

const DNS: Record<string, string[]> = {
    'loopback.test': ['127.0.0.1'],
    'metadata.google.internal': ['169.254.169.254'],
    'mixed.test': ['93.184.216.34', '10.0.0.7'],
};

const routes = new Map<string, (req: IncomingMessage, res: ServerResponse) => void>();
const hits: string[] = [];
let server: Server;
let origin: string;
// The local test server is on loopback, so the success-path tests allow exactly that address.
const allowLoopback = { allowHttp: true, allowAddress: (address: string) => address === '127.0.0.1' };

beforeAll(async () => {
    server = createServer((req, res) => {
        hits.push(req.url ?? '');
        const route = routes.get(req.url ?? '');
        if (typeof route === 'function') {
            route(req, res);
        } else {
            res.writeHead(404).end();
        }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
    routes.clear();
    hits.length = 0;
    lookup.mockReset();
    lookup.mockImplementation((hostname: string, _options: unknown, callback: (...args: unknown[]) => void) => {
        const addresses = DNS[hostname];
        if (addresses) {
            callback(
                null,
                addresses.map((address) => ({ address, family: 4 })),
            );
        } else {
            callback(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }));
        }
    });
});

describe('isPublicAddress', () => {
    it.each([
        '10.1.2.3',
        '172.16.0.1',
        '192.168.1.1',
        '127.0.0.1',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        '::1',
        '::',
        'fe80::1',
        'fd00::1',
        '::ffff:127.0.0.1',
        '::ffff:a9fe:a9fe',
        '::ffff:0:127.0.0.1',
        '::ffff:0:a9fe:a9fe',
        'not-an-ip',
    ])('refuses %s', (address) => {
        expect(isPublicAddress(address)).toBe(false);
    });

    it.each(['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111'])('accepts %s', (address) => {
        expect(isPublicAddress(address)).toBe(true);
    });
});

describe('safeFetch refusals', () => {
    it.each([
        'http://10.1.2.3/feed.xml',
        'http://169.254.169.254/latest/meta-data/',
        'http://[::1]/',
        'http://[::ffff:127.0.0.1]/',
    ])('refuses the IP literal in %s without resolving or connecting', async (url) => {
        await expect(safeFetch(url, { allowHttp: true })).rejects.toBeInstanceOf(UnsafeUrlError);
        expect(lookup).not.toHaveBeenCalled();
    });

    it.each(['http://metadata.google.internal/computeMetadata/v1/', 'http://loopback.test/', 'http://mixed.test/'])(
        'refuses %s, which resolves to a non-public address',
        async (url) => {
            await expect(safeFetch(url, { allowHttp: true })).rejects.toThrow(
                /resolves to an address that is not public/,
            );
        },
    );

    it.each(['file:///etc/passwd', 'ftp://example.com/feed.xml', 'gopher://example.com/'])(
        'refuses the scheme of %s',
        async (url) => {
            await expect(safeFetch(url, { allowHttp: true })).rejects.toThrow(/scheme .* is not allowed/);
        },
    );

    it('refuses http: unless allowHttp is set', async () => {
        await expect(safeFetch('http://example.com/')).rejects.toThrow(/scheme http: is not allowed/);
    });

    it('refuses URLs with credentials', async () => {
        await expect(safeFetch('https://user:pass@example.com/')).rejects.toThrow(/credentials/);
    });

    it.each(['http://10.0.0.1/admin', 'http://169.254.169.254/latest/meta-data/'])(
        'refuses a redirect to %s',
        async (target) => {
            routes.set('/redirect', (_req, res) => res.writeHead(302, { location: target }).end());
            await expect(safeFetch(`${origin}/redirect`, allowLoopback)).rejects.toBeInstanceOf(UnsafeUrlError);
            expect(hits).toEqual(['/redirect']);
        },
    );

    it('refuses a redirect to a non-http scheme', async () => {
        routes.set('/redirect', (_req, res) => res.writeHead(302, { location: 'file:///etc/passwd' }).end());
        await expect(safeFetch(`${origin}/redirect`, allowLoopback)).rejects.toThrow(/scheme file: is not allowed/);
    });
});

describe('safeFetch limits', () => {
    it('stops after maxRedirects', async () => {
        routes.set('/loop', (_req, res) => res.writeHead(301, { location: '/loop' }).end());
        await expect(safeFetch(`${origin}/loop`, { ...allowLoopback, maxRedirects: 2 })).rejects.toThrow(
            /Too many redirects/,
        );
        expect(hits).toHaveLength(3);
    });

    it('refuses a body over maxBytes, declared or streamed', async () => {
        routes.set('/declared', (_req, res) => res.writeHead(200, { 'content-length': '2000' }).end('x'.repeat(2000)));
        routes.set('/streamed', (_req, res) => {
            res.writeHead(200);
            res.write('x'.repeat(600));
            res.end('x'.repeat(600));
        });
        for (const path of ['/declared', '/streamed']) {
            await expect(safeFetch(`${origin}${path}`, { ...allowLoopback, maxBytes: 1000 })).rejects.toThrow(
                /larger than 1000 bytes/,
            );
        }
    });

    it('counts the decompressed size against maxBytes', async () => {
        routes.set('/bomb', (_req, res) =>
            res.writeHead(200, { 'content-encoding': 'gzip' }).end(gzipSync('x'.repeat(100_000))),
        );
        await expect(safeFetch(`${origin}/bomb`, { ...allowLoopback, maxBytes: 1000 })).rejects.toThrow(
            /larger than 1000 bytes/,
        );
    });

    it('times out when a compressed body stalls after its headers', async () => {
        routes.set('/stall', (_req, res) => {
            res.writeHead(200, { 'content-encoding': 'gzip' });
            // Half of a gzip stream, then nothing: the decoder waits for more input.
            const gzipped = gzipSync('x'.repeat(10_000));
            res.write(gzipped.subarray(0, gzipped.length >> 1));
        });
        await expect(safeFetch(`${origin}/stall`, { ...allowLoopback, timeoutMs: 200 })).rejects.toThrow(
            /timed out after 200 ms/,
        );
    });

    it('times out on a server that never answers', async () => {
        routes.set('/hang', () => {});
        await expect(safeFetch(`${origin}/hang`, { ...allowLoopback, timeoutMs: 100 })).rejects.toThrow(
            /timed out after 100 ms/,
        );
    });

    it('times out on a DNS lookup that never answers', async () => {
        lookup.mockImplementation(() => {});
        await expect(safeFetch('https://stalled.test/', { timeoutMs: 100 })).rejects.toBeInstanceOf(SafeFetchError);
        expect(lookup).toHaveBeenCalledTimes(1);
    });
});

describe('safeFetch success', () => {
    it('follows a relative redirect and returns the decoded body', async () => {
        routes.set('/old', (_req, res) => res.writeHead(301, { location: '/feed.xml' }).end());
        routes.set('/feed.xml', (req, res) =>
            res
                .writeHead(200, { 'content-type': 'application/rss+xml', 'content-encoding': 'gzip' })
                .end(gzipSync(`<rss>${req.headers.accept}</rss>`)),
        );
        const response = await safeFetch(`${origin}/old`, {
            ...allowLoopback,
            headers: { accept: 'application/rss+xml' },
        });
        expect(response.status).toBe(200);
        expect(response.url).toBe(`${origin}/feed.xml`);
        expect(response.headers.get('content-type')).toBe('application/rss+xml');
        expect(response.headers.has('content-encoding')).toBe(false);
        expect(await response.text()).toBe('<rss>application/rss+xml</rss>');
        expect(hits).toEqual(['/old', '/feed.xml']);
    });

    it('decodes a list of content codings in reverse order', async () => {
        // "gzip, br": gzip was applied first, then br.
        routes.set('/layered', (_req, res) =>
            res.writeHead(200, { 'content-encoding': 'gzip, br' }).end(brotliCompressSync(gzipSync('<rss/>'))),
        );
        const response = await safeFetch(`${origin}/layered`, allowLoopback);
        expect(await response.text()).toBe('<rss/>');
    });

    it('refuses a content coding it cannot decode', async () => {
        routes.set('/compress', (_req, res) => res.writeHead(200, { 'content-encoding': 'compress' }).end('x'));
        await expect(safeFetch(`${origin}/compress`, allowLoopback)).rejects.toThrow(
            /Unsupported content-encoding compress/,
        );
    });

    it('returns a 304 without reading or size-checking a body', async () => {
        routes.set('/cached', (_req, res) =>
            res.writeHead(304, { 'content-length': '999999999', 'content-encoding': 'gzip', etag: '"v1"' }).end(),
        );
        const response = await safeFetch(`${origin}/cached`, { ...allowLoopback, maxBytes: 1000 });
        expect(response.status).toBe(304);
        expect(response.headers.get('etag')).toBe('"v1"');
        expect(response.body).toBeNull();
    });

    it('drops credential headers when a redirect leaves the origin, and keeps them within it', async () => {
        const received: Record<string, IncomingMessage['headers']> = {};
        routes.set('/same', (_req, res) => res.writeHead(302, { location: '/dest-same' }).end());
        routes.set('/cross', (_req, res) =>
            res.writeHead(302, { location: `${origin.replace('127.0.0.1', 'loopback.test')}/dest-cross` }).end(),
        );
        for (const path of ['/dest-same', '/dest-cross']) {
            routes.set(path, (req, res) => {
                received[path] = req.headers;
                res.writeHead(200).end('ok');
            });
        }
        const headers = {
            Authorization: 'Bearer secret',
            cookie: 'session=1',
            'Proxy-Authorization': 'x',
            'x-trace': 't',
        };
        await safeFetch(`${origin}/same`, { ...allowLoopback, headers });
        await safeFetch(`${origin}/cross`, { ...allowLoopback, headers });
        expect(received['/dest-same']).toMatchObject({ authorization: 'Bearer secret', cookie: 'session=1' });
        expect(received['/dest-cross']).toMatchObject({ 'x-trace': 't' });
        expect(received['/dest-cross']).not.toHaveProperty('authorization');
        expect(received['/dest-cross']).not.toHaveProperty('cookie');
        expect(received['/dest-cross']).not.toHaveProperty('proxy-authorization');
    });

    it('returns a non-2xx response instead of throwing', async () => {
        const response = await safeFetch(`${origin}/missing`, allowLoopback);
        expect(response.status).toBe(404);
    });
});
