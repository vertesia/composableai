import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    acceptsStreamedUpload,
    fetchSignedUrl,
    isAzureBlobUrl,
    MAX_BUFFERED_STREAM_BYTES,
    signedUrlUploadHeaders,
} from './signed-url.js';

// Node's http transport is covered by node-request.test.ts; here requests go through the stubbed `fetch` unless a
// test opts in.
const nodeHttp = vi.hoisted(() => ({ available: false, request: vi.fn() }));
vi.mock('./node-request.js', () => ({
    hasNodeHttp: () => nodeHttp.available,
    nodeRequest: nodeHttp.request,
}));

function streamOf(chunk: Uint8Array): ReadableStream {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(chunk);
            controller.close();
        },
    });
}

function response(status: number, body = '', headers?: Record<string, string>): Response {
    return new Response(status === 204 ? null : body, { status, headers });
}

describe('fetchSignedUrl', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        // Make backoff instantaneous so the tests don't actually wait.
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    async function runAllTimers<T>(promise: Promise<T>): Promise<T> {
        await vi.runAllTimersAsync();
        return promise;
    }

    it('returns immediately on a successful response', async () => {
        fetchMock.mockResolvedValueOnce(response(200, 'ok'));
        const res = await runAllTimers(fetchSignedUrl('https://storage/x'));
        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries on a 503 and succeeds', async () => {
        fetchMock
            .mockResolvedValueOnce(response(503, 'try later'))
            .mockResolvedValueOnce(response(503, 'try later'))
            .mockResolvedValueOnce(response(200, 'ok'));
        const res = await runAllTimers(fetchSignedUrl('https://storage/x', { method: 'PUT', body: 'data' }));
        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('retries on connection errors and succeeds', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('network error')).mockResolvedValueOnce(response(200, 'ok'));
        const res = await runAllTimers(fetchSignedUrl('https://storage/x'));
        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry non-retryable statuses (404)', async () => {
        fetchMock.mockResolvedValueOnce(response(404, 'missing'));
        const res = await runAllTimers(fetchSignedUrl('https://storage/x'));
        expect(res.status).toBe(404);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns the last retryable response after exhausting attempts', async () => {
        fetchMock.mockResolvedValue(response(503, 'down'));
        const res = await runAllTimers(fetchSignedUrl('https://storage/x', { attempts: 3 }));
        expect(res.status).toBe(503);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('throws the connection error after exhausting attempts', async () => {
        const err = new TypeError('network down');
        fetchMock.mockRejectedValue(err);
        // Attach the rejection expectation before advancing timers to avoid an
        // unhandled rejection while the backoff timer is pending.
        const assertion = expect(fetchSignedUrl('https://storage/x', { attempts: 2 })).rejects.toThrow('network down');
        await vi.runAllTimersAsync();
        await assertion;
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('buffers a ReadableStream body so it can be replayed across retries', async () => {
        const bodies: unknown[] = [];
        fetchMock.mockImplementation((_url: string, init: RequestInit) => {
            bodies.push(init.body);
            return Promise.resolve(bodies.length < 2 ? response(503, 'retry') : response(200, 'ok'));
        });

        const stream = streamOf(new TextEncoder().encode('hello'));
        const res = await runAllTimers(
            fetchSignedUrl('https://storage/x', { method: 'PUT', body: stream as unknown as BodyInit }),
        );

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // The stream was buffered into a replayable Blob, and the same instance was reused on retry.
        expect(bodies[0]).toBeInstanceOf(Blob);
        expect(bodies[0]).toBe(bodies[1]);
    });

    it('buffers a string-chunk ReadableStream body without throwing (regression: non-Uint8Array chunk)', async () => {
        const bodies: unknown[] = [];
        fetchMock.mockImplementation((_url: string, init: RequestInit) => {
            bodies.push(init.body);
            return Promise.resolve(response(200, 'ok'));
        });

        // A web stream that yields *string* chunks — what `Readable.toWeb(Readable.from(text))`
        // produces (NodeStreamSource wraps text bodies this way). `new Response(stream).blob()`
        // rejects these under undici with "Received non-Uint8Array chunk"; the helper must
        // encode them to bytes instead.
        const stream = new ReadableStream<string>({
            start(controller) {
                controller.enqueue('hello ');
                controller.enqueue('world');
                controller.close();
            },
        });

        const res = await runAllTimers(
            fetchSignedUrl('https://storage/x', { method: 'PUT', body: stream as unknown as BodyInit }),
        );

        expect(res.status).toBe(200);
        expect(bodies[0]).toBeInstanceOf(Blob);
        expect(await (bodies[0] as Blob).text()).toBe('hello world');
    });

    it('buffers a mixed-chunk ReadableStream body, encoding strings and keeping bytes', async () => {
        const bodies: unknown[] = [];
        fetchMock.mockImplementation((_url: string, init: RequestInit) => {
            bodies.push(init.body);
            return Promise.resolve(response(200, 'ok'));
        });

        const stream = new ReadableStream<string | Uint8Array>({
            start(controller) {
                controller.enqueue('a');
                controller.enqueue(new TextEncoder().encode('b'));
                controller.close();
            },
        });

        const res = await runAllTimers(
            fetchSignedUrl('https://storage/x', { method: 'PUT', body: stream as unknown as BodyInit }),
        );

        expect(res.status).toBe(200);
        expect(bodies[0]).toBeInstanceOf(Blob);
        expect(await (bodies[0] as Blob).text()).toBe('ab');
    });

    it('throws on an object-mode stream chunk instead of silently corrupting the upload', async () => {
        const stream = new ReadableStream<unknown>({
            start(controller) {
                controller.enqueue({ not: 'bytes' });
                controller.close();
            },
        });

        await expect(
            fetchSignedUrl('https://storage/x', { method: 'PUT', body: stream as unknown as BodyInit }),
        ).rejects.toThrow(TypeError);
        // The bad body is rejected before any network call is attempted.
        expect(fetchMock).not.toHaveBeenCalled();
        expect(stream.locked).toBe(false);
    });

    it('honors a numeric Retry-After header when scheduling the retry', async () => {
        fetchMock
            .mockResolvedValueOnce(response(503, 'slow down', { 'retry-after': '30' }))
            .mockResolvedValueOnce(response(200, 'ok'));
        const pending = fetchSignedUrl('https://storage/x');
        await vi.advanceTimersByTimeAsync(29999);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        const res = await pending;
        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

describe('Retry-After request budget', () => {
    it.each(['3600', '2147484', '1e308', new Date(Date.now() + 3600000).toUTCString()])(
        'returns the intact response without an early retry for %s',
        async (retryAfter) => {
            const res = new Response('retry later', { status: 503, headers: { 'Retry-After': retryAfter } });
            const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res);
            try {
                const result = await fetchSignedUrl('https://storage/x');
                expect(result).toBe(res);
                expect(await result.text()).toBe('retry later');
                expect(fetch).toHaveBeenCalledTimes(1);
            } finally {
                fetch.mockRestore();
            }
        },
    );
});

describe('Azure Blob uploads', () => {
    const azureUrl = 'https://vertesiastore.blob.core.windows.net/vertesia-store-us3-x/file.pdf?sv=2025-01-05&sig=abc';
    const gcsUrl = 'https://storage.googleapis.com/store_dev_x/file.pdf?X-Goog-Signature=abc';
    const s3Url = 'https://vertesia-store-x.s3.us-east-1.amazonaws.com/file.pdf?X-Amz-Signature=abc';

    it('recognizes Azure Blob hosts only', () => {
        expect(isAzureBlobUrl(azureUrl)).toBe(true);
        expect(isAzureBlobUrl('https://VertesiaStore.Blob.Core.Windows.Net/c/f')).toBe(true);
        expect(isAzureBlobUrl('https://vertesiagov.blob.core.usgovcloudapi.net/c/f?sig=abc')).toBe(true);
        expect(isAzureBlobUrl(gcsUrl)).toBe(false);
        expect(isAzureBlobUrl(s3Url)).toBe(false);
        expect(isAzureBlobUrl('https://blob.core.windows.net.example.com/c/f')).toBe(false);
        expect(isAzureBlobUrl('https://blob.core.usgovcloudapi.net.example.com/c/f')).toBe(false);
        expect(isAzureBlobUrl('not a url')).toBe(false);
    });

    it('adds x-ms-blob-type for Azure and leaves GCS and S3 headers untouched', () => {
        const headers = { 'Content-Type': 'application/pdf' };
        expect(signedUrlUploadHeaders(azureUrl, headers)).toEqual({
            'Content-Type': 'application/pdf',
            'x-ms-blob-type': 'BlockBlob',
        });
        expect(signedUrlUploadHeaders(azureUrl)).toEqual({ 'x-ms-blob-type': 'BlockBlob' });
        expect(signedUrlUploadHeaders(gcsUrl, headers)).toBe(headers);
        expect(signedUrlUploadHeaders(s3Url, headers)).toBe(headers);
        expect(signedUrlUploadHeaders(s3Url)).toBeUndefined();
    });

    it('keeps a caller-provided blob type', () => {
        const headers = { 'X-Ms-Blob-Type': 'AppendBlob' };
        expect(signedUrlUploadHeaders(azureUrl, headers)).toBe(headers);
    });

    it('sends the blob type on Azure PUTs only', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('ok'));
        try {
            await fetchSignedUrl(azureUrl, { method: 'PUT', body: 'x', headers: { 'Content-Type': 'text/plain' } });
            await fetchSignedUrl(gcsUrl, { method: 'PUT', body: 'x', headers: { 'Content-Type': 'text/plain' } });
            await fetchSignedUrl(azureUrl);
            expect(fetch.mock.calls[0][1]?.headers).toEqual({
                'Content-Type': 'text/plain',
                'x-ms-blob-type': 'BlockBlob',
            });
            expect(fetch.mock.calls[1][1]?.headers).toEqual({ 'Content-Type': 'text/plain' });
            expect(fetch.mock.calls[2][1]?.headers).toBeUndefined();
        } finally {
            fetch.mockRestore();
        }
    });
});

describe('stream bodies longer than the retry buffer', () => {
    const gcsUrl = 'https://storage.googleapis.com/bucket/large.bin?X-Goog-Signature=abc';
    const s3Url = 'https://bucket.s3.us-east-1.amazonaws.com/large.bin?X-Amz-Signature=abc';
    const azureUrl = 'https://account.blob.core.windows.net/container/large.bin?sig=abc';
    const CHUNK = 1024 * 1024;

    /** A stream of `chunks` 1 MiB chunks, each filled with its index, generated on demand. */
    function generated(chunks: number): ReadableStream<Uint8Array> {
        let i = 0;
        return new ReadableStream<Uint8Array>(
            {
                pull(controller) {
                    if (i === chunks) {
                        controller.close();
                        return;
                    }
                    controller.enqueue(new Uint8Array(CHUNK).fill(i++ % 256));
                },
            },
            { highWaterMark: 0 },
        );
    }

    async function digest(body: BodyInit): Promise<{ size: number; first: number; last: number }> {
        const bytes = new Uint8Array(await new Response(body).arrayBuffer());
        return { size: bytes.byteLength, first: bytes[0], last: bytes[bytes.byteLength - 1] };
    }

    afterEach(() => {
        nodeHttp.available = false;
        nodeHttp.request.mockReset();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('sends large and streamed bodies with Node http, and small ones with fetch', async () => {
        nodeHttp.available = true;
        nodeHttp.request.mockImplementation(async (_url: string, init: { body: BodyInit }) => {
            await digest(init.body);
            return new Response(null, { status: 200 });
        });
        const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        await fetchSignedUrl(gcsUrl, { method: 'PUT', body: generated(MAX_BUFFERED_STREAM_BYTES / CHUNK + 1) });
        await fetchSignedUrl(s3Url, { method: 'PUT', body: new Blob([new Uint8Array(MAX_BUFFERED_STREAM_BYTES + 1)]) });
        await fetchSignedUrl(s3Url, { method: 'PUT', body: generated(1) });

        expect(nodeHttp.request).toHaveBeenCalledTimes(2);
        expect(nodeHttp.request.mock.calls[0][1].body).toBeInstanceOf(ReadableStream);
        expect(nodeHttp.request.mock.calls[1][1].body).toBeInstanceOf(Blob);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('recognizes the services that accept an upload of unknown length', () => {
        expect(acceptsStreamedUpload(gcsUrl)).toBe(true);
        expect(acceptsStreamedUpload('https://bucket.storage.googleapis.com/large.bin')).toBe(true);
        expect(acceptsStreamedUpload(s3Url)).toBe(false);
        expect(acceptsStreamedUpload(azureUrl)).toBe(false);
        expect(acceptsStreamedUpload('https://storage.googleapis.com.example.com/x')).toBe(false);
        expect(acceptsStreamedUpload('not a url')).toBe(false);
    });

    it('keeps buffering a stream that fits, so it is retried', async () => {
        const bodies: BodyInit[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string, init: RequestInit) => {
                bodies.push(init.body as BodyInit);
                return new Response(null, { status: bodies.length === 1 ? 503 : 200 });
            }),
        );
        const chunks = MAX_BUFFERED_STREAM_BYTES / CHUNK;
        const res = await fetchSignedUrl(gcsUrl, { method: 'PUT', body: generated(chunks), baseDelayMs: 0 });
        expect(res.status).toBe(200);
        expect(bodies).toHaveLength(2);
        expect(bodies[0]).toBeInstanceOf(Blob);
        expect(bodies[1]).toBe(bodies[0]);
    });

    it('sends a longer stream to GCS once, as a stream, with every byte in order', async () => {
        const seen: { init: RequestInit; digest: Awaited<ReturnType<typeof digest>> }[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string, init: RequestInit) => {
                seen.push({ init, digest: await digest(init.body as BodyInit) });
                return new Response(null, { status: 503 });
            }),
        );
        const chunks = MAX_BUFFERED_STREAM_BYTES / CHUNK + 8;
        const res = await fetchSignedUrl(gcsUrl, { method: 'PUT', body: generated(chunks), baseDelayMs: 0 });

        // A stream cannot be replayed, so a retryable status is returned to the caller instead of retried.
        expect(res.status).toBe(503);
        expect(seen).toHaveLength(1);
        expect(seen[0].init.body).toBeInstanceOf(ReadableStream);
        expect((seen[0].init as RequestInit & { duplex?: string }).duplex).toBe('half');
        expect(seen[0].digest).toEqual({ size: chunks * CHUNK, first: 0, last: (chunks - 1) % 256 });
    });

    it('does not retry a connection error on a streamed body', async () => {
        const fetchMock = vi.fn(async () => {
            throw new TypeError('fetch failed');
        });
        vi.stubGlobal('fetch', fetchMock);
        const chunks = MAX_BUFFERED_STREAM_BYTES / CHUNK + 1;
        await expect(
            fetchSignedUrl(gcsUrl, { method: 'PUT', body: generated(chunks), baseDelayMs: 0 }),
        ).rejects.toThrow('fetch failed');
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it.each([
        ['S3', s3Url],
        ['Azure', azureUrl],
    ])('buffers a longer stream to %s, which needs a Content-Length', async (_name, url) => {
        const bodies: BodyInit[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string, init: RequestInit) => {
                bodies.push(init.body as BodyInit);
                return new Response(null, { status: 200 });
            }),
        );
        const chunks = MAX_BUFFERED_STREAM_BYTES / CHUNK + 2;
        await fetchSignedUrl(url, { method: 'PUT', body: generated(chunks) });
        expect(bodies[0]).toBeInstanceOf(Blob);
        expect((bodies[0] as Blob).size).toBe(chunks * CHUNK);
    });

    it('reads no more than the buffer from a long stream before sending it', async () => {
        let pulled = 0;
        let pulledBeforeSend = 0;
        const body = new ReadableStream<Uint8Array>(
            {
                pull(controller) {
                    if (pulled === 1024) {
                        controller.close();
                        return;
                    }
                    pulled++;
                    controller.enqueue(new Uint8Array(CHUNK));
                },
            },
            { highWaterMark: 0 },
        );
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string, init: RequestInit) => {
                pulledBeforeSend = pulled;
                await (init.body as ReadableStream).cancel();
                return new Response(null, { status: 200 });
            }),
        );
        await fetchSignedUrl(gcsUrl, { method: 'PUT', body });
        // 16 MiB buffered, plus the chunk that crossed the limit.
        expect(pulledBeforeSend).toBe(MAX_BUFFERED_STREAM_BYTES / CHUNK + 1);
        // Cancelling the request body cancels the source stream instead of draining 1 GiB.
        expect(pulled).toBe(pulledBeforeSend);
    });
});
