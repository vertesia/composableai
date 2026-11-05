import { createReadStream } from 'node:fs';
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ZenoClient } from '../store/client.js';
import { nodeRequest } from '../store/node-request.js';
import { fetchSignedUrl } from '../store/signed-url.js';
import { getUploadBody } from '../store/upload-body.js';
import { NodeStreamSource } from './NodeStreamSource.js';

let dir: string;

beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vertesia-file-upload-'));
});

afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('NodeStreamSource file-backed body', () => {
    it('offers a blob of the whole file for a stream opened by path', async () => {
        const file = join(dir, 'whole.txt');
        await writeFile(file, 'hello file');
        const source = new NodeStreamSource(createReadStream(file), 'whole.txt', 'text/plain');
        const body = await source.replayableBody();
        expect(body).toBeInstanceOf(Blob);
        expect(body?.type).toBe('text/plain');
        expect(await body?.text()).toBe('hello file');
    });

    it.each([
        ['a range', (file: string) => createReadStream(file, { start: 2 })],
        ['a stream that is not a file', () => Readable.from(['not a file'])],
    ])('offers none for %s', async (_name, open) => {
        const file = join(dir, 'range.txt');
        await writeFile(file, 'hello file');
        const source = new NodeStreamSource(open(file), 'range.txt');
        expect(await source.replayableBody()).toBeUndefined();
    });

    it('offers none for a file stream that was already read', async () => {
        const file = join(dir, 'read.txt');
        await writeFile(file, 'hello file');
        const stream = createReadStream(file);
        await new Promise<void>((resolve) => stream.once('readable', () => resolve()));
        stream.read(1);
        expect(await new NodeStreamSource(stream, 'read.txt').replayableBody()).toBeUndefined();
    });

    it('uploads the blob instead of the stream and releases the file stream', async () => {
        const file = join(dir, 'upload.txt');
        await writeFile(file, 'hello file');
        const stream = createReadStream(file);
        const body = await getUploadBody(new NodeStreamSource(stream, 'upload.txt'));
        expect(body).toBeInstanceOf(Blob);
        expect(stream.destroyed).toBe(true);
    });

    it('retries a failed upload of a file by sending the file again', async () => {
        const file = join(dir, 'retry.txt');
        await writeFile(file, 'retry me');
        const received: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string, init: RequestInit) => {
                received.push(await new Response(init.body).text());
                return new Response(null, { status: received.length === 1 ? 503 : 200 });
            }),
        );
        const sign = vi.fn(async () =>
            Response.json({ url: 'https://bucket.s3.amazonaws.com/retry.txt', id: 's3://bucket/retry.txt', path: 'p' }),
        );
        const client = new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: sign });

        await client.files.uploadFile(new NodeStreamSource(createReadStream(file), 'retry.txt', 'text/plain'));

        expect(received).toEqual(['retry me', 'retry me']);
    });
});

describe('uploading a large file through fetchSignedUrl', () => {
    const SIZE = 512 * 1024 * 1024;
    let server: Server;
    let url: string;
    let receivedBytes = 0;

    beforeAll(async () => {
        server = createServer((req, res) => {
            req.on('data', (chunk: Buffer) => {
                receivedBytes += chunk.byteLength;
            });
            req.on('end', () => res.writeHead(200).end());
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/upload`;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('streams a file-backed blob from disk without loading it into memory', async () => {
        const file = join(dir, 'large.bin');
        await writeFile(file, '');
        await truncate(file, SIZE);
        const stream = createReadStream(file);
        const body = await getUploadBody(new NodeStreamSource(stream, 'large.bin'));

        const baseline = process.memoryUsage();
        let peakArrayBuffers = 0;
        let peakRss = 0;
        const sampler = setInterval(() => {
            const usage = process.memoryUsage();
            peakArrayBuffers = Math.max(peakArrayBuffers, usage.arrayBuffers - baseline.arrayBuffers);
            peakRss = Math.max(peakRss, usage.rss - baseline.rss);
        }, 5);
        try {
            receivedBytes = 0;
            const res = await fetchSignedUrl(url, { method: 'PUT', body: body as BodyInit });
            expect(res.status).toBe(200);
        } finally {
            clearInterval(sampler);
        }

        expect(receivedBytes).toBe(SIZE);
        // A buffered upload, or Node's fetch, holds all 512 MiB. Reading from disk holds a few chunks at a time;
        // the bound leaves room for garbage not yet collected on either side of the in-process server.
        expect(peakArrayBuffers).toBeLessThan(SIZE / 4);
        expect(peakRss).toBeLessThan(SIZE / 2);
    }, 60_000);

    it('streams a body of unknown length without holding it in memory', async () => {
        const chunk = 1024 * 1024;
        let produced = 0;
        const body = new ReadableStream<Uint8Array>(
            {
                pull(controller) {
                    if (produced === SIZE) {
                        controller.close();
                        return;
                    }
                    produced += chunk;
                    controller.enqueue(new Uint8Array(chunk));
                },
            },
            { highWaterMark: 0 },
        );
        const baseline = process.memoryUsage().arrayBuffers;
        let peak = 0;
        const sampler = setInterval(() => {
            peak = Math.max(peak, process.memoryUsage().arrayBuffers - baseline);
        }, 5);
        try {
            receivedBytes = 0;
            const res = await nodeRequest(url, { method: 'PUT', body });
            expect(res.status).toBe(200);
        } finally {
            clearInterval(sampler);
        }
        expect(receivedBytes).toBe(SIZE);
        expect(peak).toBeLessThan(SIZE / 4);
    }, 60_000);
});
