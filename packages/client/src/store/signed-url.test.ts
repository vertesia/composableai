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

    it('honors a numeric Retry-After header when scheduling the retry', async () => {
        fetchMock
            .mockResolvedValueOnce(response(503, 'slow down', { 'retry-after': '2' }))
            .mockResolvedValueOnce(response(200, 'ok'));
        const res = await runAllTimers(fetchSignedUrl('https://storage/x'));
        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
