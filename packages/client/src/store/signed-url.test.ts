import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSignedUrl, isAzureBlobUrl, signedUrlUploadHeaders } from './signed-url.js';

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
        expect(isAzureBlobUrl(gcsUrl)).toBe(false);
        expect(isAzureBlobUrl(s3Url)).toBe(false);
        expect(isAzureBlobUrl('https://blob.core.windows.net.example.com/c/f')).toBe(false);
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
