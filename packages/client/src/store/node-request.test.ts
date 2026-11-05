import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ContentLengthMismatchError, hasNodeHttp, nodeRequest } from './node-request.js';

interface Received {
    headers: IncomingHttpHeaders;
    body: string;
}

describe('nodeRequest', () => {
    let server: Server;
    let base: string;
    let received: Received[] = [];

    beforeAll(async () => {
        server = createServer((req, res) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
                received.push({ headers: req.headers, body: Buffer.concat(chunks).toString() });
                if (req.url === '/empty') {
                    res.writeHead(204).end();
                } else {
                    res.writeHead(201, 'Stored', { etag: '"abc"', 'x-multi': ['a', 'b'] }).end('stored');
                }
            });
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('runs in Node', () => {
        expect(hasNodeHttp()).toBe(true);
    });

    it('sends a Blob with its length and returns the response', async () => {
        received = [];
        const res = await nodeRequest(`${base}/blob`, {
            method: 'PUT',
            headers: { 'Content-Type': 'text/plain' },
            body: new Blob(['hello blob']),
        });
        expect(res.status).toBe(201);
        expect(res.statusText).toBe('Stored');
        expect(res.headers.get('etag')).toBe('"abc"');
        expect(res.headers.get('x-multi')).toBe('a, b');
        expect(await res.text()).toBe('stored');
        expect(received[0].body).toBe('hello blob');
        expect(received[0].headers['content-length']).toBe('10');
        expect(received[0].headers['content-type']).toBe('text/plain');
        expect(received[0].headers['transfer-encoding']).toBeUndefined();
    });

    it('sends a stream of unknown length with chunked transfer encoding', async () => {
        received = [];
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('hello '));
                controller.enqueue(new TextEncoder().encode('stream'));
                controller.close();
            },
        });
        const res = await nodeRequest(`${base}/stream`, { method: 'PUT', body });
        expect(res.status).toBe(201);
        expect(received[0].body).toBe('hello stream');
        expect(received[0].headers['transfer-encoding']).toBe('chunked');
        expect(received[0].headers['content-length']).toBeUndefined();
    });

    function streamOf(bytes: number): ReadableStream<Uint8Array> {
        return new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(bytes).fill(97));
                controller.close();
            },
        });
    }

    it('sends a stream with its declared length instead of chunked encoding', async () => {
        received = [];
        const res = await nodeRequest(`${base}/declared`, {
            method: 'PUT',
            headers: { 'Content-Length': '10' },
            body: streamOf(10),
        });
        expect(res.status).toBe(201);
        expect(received[0].body).toBe('a'.repeat(10));
        expect(received[0].headers['content-length']).toBe('10');
        expect(received[0].headers['transfer-encoding']).toBeUndefined();
    });

    it.each([
        ['ends short of', 5],
        ['runs past', 20],
    ])('fails when a stream %s its declared length', async (_name, bytes) => {
        await expect(
            nodeRequest(`${base}/mismatch`, {
                method: 'PUT',
                headers: { 'content-length': '10' },
                body: streamOf(bytes),
            }),
        ).rejects.toBeInstanceOf(ContentLengthMismatchError);
    });

    it('never completes the body of a stream that runs past its length at a chunk boundary', async () => {
        received = [];
        const body = new ReadableStream<Uint8Array>({
            async pull(controller) {
                controller.enqueue(new Uint8Array(10).fill(98));
                // let the first chunk reach the server before the extra one appears
                await new Promise((resolve) => setTimeout(resolve, 50));
                controller.enqueue(new Uint8Array(1));
                controller.close();
            },
        });
        await expect(
            nodeRequest(`${base}/boundary`, { method: 'PUT', headers: { 'Content-Length': '10' }, body }),
        ).rejects.toBeInstanceOf(ContentLengthMismatchError);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(received).toEqual([]);
    });

    it("sends a Blob's own size over a declared length", async () => {
        received = [];
        await nodeRequest(`${base}/blob-length`, {
            method: 'PUT',
            headers: { 'Content-Length': '99' },
            body: new Blob(['four']),
        });
        expect(received[0].headers['content-length']).toBe('4');
    });

    it('returns a null body for a 204', async () => {
        const res = await nodeRequest(`${base}/empty`, { method: 'PUT', body: new Blob(['x']) });
        expect(res.status).toBe(204);
        expect(res.body).toBeNull();
    });

    it('rejects on a connection error', async () => {
        const closed = createServer();
        await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
        const { port } = closed.address() as AddressInfo;
        await new Promise<void>((resolve) => closed.close(() => resolve()));
        await expect(
            nodeRequest(`http://127.0.0.1:${port}/`, { method: 'PUT', body: new Blob(['x']) }),
        ).rejects.toThrow(/ECONNREFUSED/);
    });

    it('fails the request when the body stream errors', async () => {
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                controller.error(new Error('source failed'));
            },
        });
        await expect(nodeRequest(`${base}/broken`, { method: 'PUT', body })).rejects.toThrow('source failed');
    });
});
