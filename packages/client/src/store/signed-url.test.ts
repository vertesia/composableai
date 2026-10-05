import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSignedUrl } from './signed-url.js';

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

describe('signed transfer cancellation', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it.each([undefined, 15 * 60_000])('keeps a transfer active with timeoutMs=%s', async (timeoutMs) => {
        vi.useFakeTimers();
        const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
            const controller = new AbortController();
            setTimeout(
                () => controller.abort(new DOMException('Transfer deadline exceeded', 'TimeoutError')),
                milliseconds,
            );
            return controller.signal;
        });
        let complete: ((value: Response) => void) | undefined;
        const fetch = vi.fn(
            (_url: string, init: RequestInit) =>
                new Promise<Response>((resolve, reject) => {
                    complete = resolve;
                    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
                }),
        );
        vi.stubGlobal('fetch', fetch);
        const pending = fetchSignedUrl('https://storage.test/image', { method: 'PUT', body: 'image', timeoutMs });
        await vi.advanceTimersByTimeAsync(timeoutMs === undefined ? 16 * 60_000 : 5 * 60_000);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][1].signal?.aborted).toBe(false);
        if (timeoutMs === undefined) expect(timeout).not.toHaveBeenCalled();
        else expect(timeout).toHaveBeenCalledWith(timeoutMs);
        complete?.(new Response(null, { status: 204 }));
        await expect(pending).resolves.toMatchObject({ status: 204 });
    });

    it('expires an explicit fifteen-minute deadline without retrying', async () => {
        vi.useFakeTimers();
        vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
            const controller = new AbortController();
            setTimeout(
                () => controller.abort(new DOMException('Transfer deadline exceeded', 'TimeoutError')),
                milliseconds,
            );
            return controller.signal;
        });
        const fetch = vi.fn(
            (_url: string, init: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
                }),
        );
        vi.stubGlobal('fetch', fetch);
        const pending = fetchSignedUrl('https://storage.test/image', { method: 'PUT', timeoutMs: 15 * 60_000 });
        const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
        await vi.advanceTimersByTimeAsync(15 * 60_000 - 1);
        expect(fetch.mock.calls[0][1].signal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await assertion;
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('aborts a stalled PUT at the total deadline without retrying', async () => {
        const fetch = vi.fn(
            (_url: string, init: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
                }),
        );
        vi.stubGlobal('fetch', fetch);
        await expect(
            fetchSignedUrl('https://storage.test/image', { method: 'PUT', body: 'image', timeoutMs: 10 }),
        ).rejects.toMatchObject({ name: 'TimeoutError' });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][1].signal?.aborted).toBe(true);
    });

    it('cancels buffering and releases the stream reader', async () => {
        const controller = new AbortController();
        const cancel = vi.fn();
        const stream = new ReadableStream({ cancel });
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const pending = fetchSignedUrl('https://storage.test/image', {
            method: 'PUT',
            body: stream,
            signal: controller.signal,
        });
        const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        controller.abort();
        await assertion;
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(stream.locked).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('interrupts Retry-After backoff and cleans its timer without another request', async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        const response = new Response('retry', { status: 503, headers: { 'Retry-After': '30' } });
        if (!response.body) throw new Error('Missing response body');
        const cancel = vi.spyOn(response.body, 'cancel');
        const fetch = vi.fn().mockResolvedValue(response);
        vi.stubGlobal('fetch', fetch);
        const pending = fetchSignedUrl('https://storage.test/image', { signal: controller.signal });
        const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        await vi.advanceTimersByTimeAsync(1);
        controller.abort();
        await assertion;
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not start a cancelled request', async () => {
        const controller = new AbortController();
        controller.abort();
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        await expect(fetchSignedUrl('https://storage.test/image', { signal: controller.signal })).rejects.toMatchObject(
            { name: 'AbortError' },
        );
        expect(fetch).not.toHaveBeenCalled();
    });
});

it('does not let stalled response cleanup block a storage retry', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => undefined));
    const retry = new Response(new ReadableStream({ cancel }), { status: 503 });
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(retry)
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    try {
        await expect(
            fetchSignedUrl('https://storage.test/image', { baseDelayMs: 0, maxDelayMs: 0 }),
        ).resolves.toMatchObject({ status: 204 });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
        vi.unstubAllGlobals();
    }
});
