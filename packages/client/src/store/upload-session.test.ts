import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamSource } from '../StreamSource.js';
import * as chunked from './chunked-upload.js';
import { ZenoClient } from './client.js';

const mib = 1024 * 1024;

// Bodies too long for `fetch` go through Node's http transport; keep those off the network too.
const nodeRequest = vi.hoisted(() => vi.fn());
vi.mock('./node-request.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./node-request.js')>()),
    nodeRequest,
}));

function zeroStream(size: number): ReadableStream<Uint8Array> {
    let produced = 0;
    return new ReadableStream<Uint8Array>({
        pull(controller) {
            if (produced >= size) {
                controller.close();
                return;
            }
            const n = Math.min(mib, size - produced);
            produced += n;
            controller.enqueue(new Uint8Array(n));
        },
    });
}

interface ApiCall {
    path: string;
    payload: Record<string, unknown>;
}

/** A client whose API answers from `routes`, recording each call. */
function clientWith(routes: Record<string, (payload: Record<string, unknown>) => unknown>) {
    const calls: ApiCall[] = [];
    const api = vi.fn(async (input: string | URL | Request) => {
        const request = input as Request;
        const path = new URL(request.url).pathname.replace(/^\/api\/v1/, '');
        const payload = JSON.parse((await request.text()) || '{}') as Record<string, unknown>;
        calls.push({ path, payload });
        const route = routes[path];
        if (!route) return Response.json({ message: `no route ${path}` }, { status: 404 });
        return Response.json(route(payload));
    });
    return { client: new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: api }), calls };
}

const s3Session = {
    protocol: 's3_multipart',
    id: 's3://bucket/big.bin',
    path: 'bucket/big.bin',
    mime_type: 'application/octet-stream',
    part_size: 8 * mib,
    upload_id: 'upload-1',
};

const s3Routes = {
    '/files/upload-sessions': () => s3Session,
    '/files/upload-sessions/parts': (payload: Record<string, unknown>) => ({
        parts: (payload.part_numbers as number[]).map((n) => ({
            part_number: n,
            url: `https://bucket.s3.amazonaws.com/big.bin?partNumber=${n}`,
        })),
    }),
    '/files/upload-sessions/complete': () => ({ id: s3Session.id, path: s3Session.path, etag: 'multi-3' }),
    '/files/upload-sessions/abort': () => ({ id: s3Session.id, aborted: true }),
};

describe('uploads of long streams', () => {
    let storage: { url: string; size: number }[];

    beforeEach(() => {
        storage = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string, init: RequestInit) => {
                const size = init.body instanceof Blob ? init.body.size : -1;
                storage.push({ url, size });
                return new Response(null, { status: 200, headers: { etag: `"part-${storage.length}"` } });
            }),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('uploads a stream longer than one part through an upload session', async () => {
        const { client, calls } = clientWith(s3Routes);

        const id = await client.files.uploadFile(new StreamSource(zeroStream(20 * mib), 'big.bin'));

        expect(id).toBe('s3://bucket/big.bin');
        expect(calls.map((c) => c.path)).toEqual([
            '/files/upload-sessions',
            '/files/upload-sessions/parts',
            '/files/upload-sessions/complete',
        ]);
        expect(calls[0].payload).toEqual({ name: 'big.bin' });
        expect(storage.map((s) => s.size)).toEqual([8 * mib, 8 * mib, 4 * mib]);
        expect(calls[2].payload.parts).toEqual([
            { part_number: 1, etag: '"part-1"' },
            { part_number: 2, etag: '"part-2"' },
            { part_number: 3, etag: '"part-3"' },
        ]);
    });

    it('returns the session file and its ETag when an object is uploaded in parts', async () => {
        const { client } = clientWith(s3Routes);
        const result = await client.objects.upload(
            new StreamSource(zeroStream(17 * mib), 'big.bin', 'application/octet-stream'),
        );
        expect(result).toEqual({
            source: s3Session.id,
            name: 'big.bin',
            type: 'application/octet-stream',
            etag: 'multi-3',
        });
    });

    it('uses a single signed PUT for a stream that fits in one part', async () => {
        const { client, calls } = clientWith({
            '/files/upload-url': () => ({
                url: 'https://bucket.s3.amazonaws.com/small',
                id: 's3://bucket/small',
                path: 'p',
            }),
        });
        await client.files.uploadFile(new StreamSource(zeroStream(mib), 'small.bin'));
        expect(calls.map((c) => c.path)).toEqual(['/files/upload-url']);
        expect(storage).toEqual([{ url: 'https://bucket.s3.amazonaws.com/small', size: mib }]);
    });

    it('falls back to a single signed PUT when the session needs an SDK that is not installed', async () => {
        nodeRequest.mockImplementation(async (url: string, init: { body: ReadableStream }) => {
            let size = 0;
            for await (const chunk of init.body as unknown as AsyncIterable<Uint8Array>) size += chunk.byteLength;
            storage.push({ url, size });
            return new Response(null, { status: 200 });
        });
        vi.spyOn(chunked, 'uploadInParts').mockRejectedValue(
            new chunked.UploadSessionUnavailableError('@google-cloud/storage', new Error('not found')),
        );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { client, calls } = clientWith({
            '/files/upload-sessions': () => ({
                protocol: 'gcs_resumable',
                id: 'gs://bucket/big.bin',
                path: 'bucket/big.bin',
                part_size: 8 * mib,
                url: 'https://storage.googleapis.com/upload/session',
            }),
            '/files/upload-url': () => ({
                url: 'https://storage.googleapis.com/bucket/big.bin?X-Goog-Signature=x',
                id: 'gs://bucket/big.bin',
                path: 'bucket/big.bin',
            }),
        });
        const id = await client.files.uploadFile(new StreamSource(zeroStream(20 * mib), 'big.bin'));

        expect(id).toBe('gs://bucket/big.bin');
        expect(calls.map((c) => c.path)).toEqual(['/files/upload-sessions', '/files/upload-url']);
        // the whole stream, in one request
        expect(storage).toEqual([
            { url: 'https://storage.googleapis.com/bucket/big.bin?X-Goog-Signature=x', size: 20 * mib },
        ]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('@google-cloud/storage'));
    });

    it.each([404, 501])('falls back to a single signed PUT when starting a session answers %i', async (status) => {
        nodeRequest.mockImplementation(async (url: string, init: { body: Blob }) => {
            storage.push({ url, size: init.body.size });
            return new Response(null, { status: 200 });
        });
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { client, calls } = clientWith({
            '/files/upload-url': () => ({
                url: 'https://bucket.s3.amazonaws.com/big',
                id: 's3://bucket/big',
                path: 'p',
            }),
        });
        // 404: the route does not exist. 501: the server's storage has no upload sessions.
        const api = vi.spyOn(client.files, 'createUploadSession');
        if (status === 501) {
            const { RequestError } = await import('@vertesia/api-fetch-client');
            api.mockRejectedValueOnce(
                new RequestError(
                    'not supported',
                    new Request('https://store.test/api/v1/files/upload-sessions'),
                    501,
                    {},
                ),
            );
        }
        const id = await client.files.uploadFile(new StreamSource(zeroStream(20 * mib), 'big.bin'));

        expect(id).toBe('s3://bucket/big');
        expect(calls.map((c) => c.path).at(-1)).toBe('/files/upload-url');
        expect(storage).toEqual([{ url: 'https://bucket.s3.amazonaws.com/big', size: 20 * mib }]);
    });

    it('fails when starting a session fails for another reason', async () => {
        const { client } = clientWith({ '/files/upload-sessions': () => ({}) });
        vi.spyOn(client.files, 'createUploadSession').mockRejectedValueOnce(new Error('forbidden'));
        await expect(client.files.uploadFile(new StreamSource(zeroStream(20 * mib), 'big.bin'))).rejects.toThrow(
            'forbidden',
        );
        expect(storage).toEqual([]);
    });

    it('aborts the session and fails when a part cannot be uploaded', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('no', { status: 403, statusText: 'Forbidden' })),
        );
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { client, calls } = clientWith(s3Routes);
        await expect(client.files.uploadFile(new StreamSource(zeroStream(20 * mib), 'big.bin'))).rejects.toThrow(
            'Failed to upload part 1',
        );
        // the refused part is signed again once before the upload is aborted
        expect(calls.map((c) => c.path)).toEqual([
            '/files/upload-sessions',
            '/files/upload-sessions/parts',
            '/files/upload-sessions/parts',
            '/files/upload-sessions/abort',
        ]);
    });
});
