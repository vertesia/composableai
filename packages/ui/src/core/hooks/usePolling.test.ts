import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPermanentRequestError, usePolling } from './usePolling';

function httpError(status: number, retryAfterMs?: number) {
    return Object.assign(new Error(`HTTP ${status}`), { status, retryAfterMs });
}

/** Flushes pending promise callbacks, then advances fake time by `ms`. */
async function advance(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe('usePolling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('polls on a fixed interval until the task reports it is finished', async () => {
        const task = vi
            .fn<() => Promise<boolean>>()
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(false)
            .mockResolvedValue(true);
        renderHook(() => usePolling(task, { intervalMs: 5_000 }, []));

        await advance(0);
        expect(task).toHaveBeenCalledTimes(1);
        await advance(5_000);
        expect(task).toHaveBeenCalledTimes(2);
        await advance(5_000);
        expect(task).toHaveBeenCalledTimes(3);
        await advance(60_000);
        expect(task).toHaveBeenCalledTimes(3);
    });

    it('stops on a permanent error and reports it', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockRejectedValue(httpError(404));
        const onError = vi.fn();
        renderHook(() => usePolling(task, { intervalMs: 5_000, onError }, []));

        await advance(0);
        await advance(60_000);
        expect(task).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }), true);
    });

    it('retries a 404 only when the call site opts in with retryStatuses', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockRejectedValue(httpError(404));
        renderHook(() => usePolling(task, { intervalMs: 5_000, retryStatuses: [404] }, []));

        await advance(0);
        await advance(5_000);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('keeps the fixed interval after a transient error when backoff is not requested', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockRejectedValue(httpError(503));
        renderHook(() => usePolling(task, { intervalMs: 5_000 }, []));

        await advance(0);
        await advance(5_000);
        await advance(5_000);
        expect(task).toHaveBeenCalledTimes(3);
    });

    it('treats 429 as transient, so the loop continues', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockRejectedValue(httpError(429));
        renderHook(() => usePolling(task, { intervalMs: 5_000 }, []));

        await advance(0);
        await advance(5_000);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('doubles the wait after each failure when backoff is requested, up to the cap', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockRejectedValue(httpError(503));
        renderHook(() => usePolling(task, { intervalMs: 1_000, backoff: { maxMs: 4_000 } }, []));

        await advance(0);
        expect(task).toHaveBeenCalledTimes(1);
        await advance(999);
        expect(task).toHaveBeenCalledTimes(1);
        await advance(1);
        expect(task).toHaveBeenCalledTimes(2); // waited 1s
        await advance(2_000);
        expect(task).toHaveBeenCalledTimes(3); // waited 2s
        await advance(4_000);
        expect(task).toHaveBeenCalledTimes(4); // waited 4s, the cap
        await advance(4_000);
        expect(task).toHaveBeenCalledTimes(5); // still capped
    });

    it('waits at least the server Retry-After hint', async () => {
        const task = vi
            .fn<() => Promise<boolean>>()
            .mockRejectedValueOnce(httpError(429, 10_000))
            .mockResolvedValue(true);
        renderHook(() => usePolling(task, { intervalMs: 1_000 }, []));

        await advance(0);
        await advance(9_999);
        expect(task).toHaveBeenCalledTimes(1);
        await advance(1);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('stops at unmount, and a request that fails afterwards schedules nothing', async () => {
        let reject: (err: unknown) => void = () => undefined;
        const task = vi.fn(
            () =>
                new Promise<boolean>((_, rej) => {
                    reject = rej;
                }),
        );
        const onError = vi.fn();
        const { unmount } = renderHook(() => usePolling(task, { intervalMs: 5_000, onError }, []));

        await advance(0);
        unmount();
        await act(async () => {
            reject(httpError(503));
        });
        await advance(60_000);
        expect(task).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it('does nothing while disabled, and starts when enabled', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
        const { rerender } = renderHook(({ enabled }) => usePolling(task, { intervalMs: 5_000, enabled }, []), {
            initialProps: { enabled: false },
        });

        await advance(60_000);
        expect(task).not.toHaveBeenCalled();
        rerender({ enabled: true });
        await advance(0);
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('restarts when a dependency changes', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
        const { rerender } = renderHook(({ id }) => usePolling(task, { intervalMs: 5_000 }, [id]), {
            initialProps: { id: 'a' },
        });

        await advance(0);
        rerender({ id: 'b' });
        await advance(0);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('trigger runs a poll at once and leaves the schedule in place', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
        const { result } = renderHook(() => usePolling(task, { intervalMs: 60_000, immediate: false }, []));

        await advance(0);
        expect(task).not.toHaveBeenCalled();
        act(() => result.current.trigger());
        await advance(0);
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('aborts the signal given to the task when the loop unmounts', async () => {
        let captured: AbortSignal | undefined;
        const task = vi.fn((signal: AbortSignal) => {
            captured = signal;
            return new Promise<boolean>(() => undefined);
        });
        const { unmount } = renderHook(() => usePolling(task, { intervalMs: 5_000 }, []));

        await advance(0);
        expect(captured?.aborted).toBe(false);
        unmount();
        expect(captured?.aborted).toBe(true);
    });

    it('trigger does nothing after a permanent error has stopped polling', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockRejectedValue(httpError(404));
        const { result } = renderHook(() => usePolling(task, { intervalMs: 5_000 }, []));

        await advance(0);
        act(() => result.current.trigger());
        await advance(0);
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('skips the request while the document is hidden', async () => {
        const task = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
        const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        renderHook(() => usePolling(task, { intervalMs: 5_000, skipWhenHidden: true }, []));

        await advance(10_000);
        expect(task).not.toHaveBeenCalled();
        hidden.mockReturnValue(false);
        await advance(5_000);
        expect(task).toHaveBeenCalledTimes(1);
    });
});

describe('isPermanentRequestError', () => {
    it('classifies client errors other than 408 and 429 as permanent', () => {
        expect(isPermanentRequestError(httpError(403))).toBe(true);
        expect(isPermanentRequestError(httpError(404))).toBe(true);
        expect(isPermanentRequestError(httpError(401))).toBe(false);
        expect(isPermanentRequestError(httpError(408))).toBe(false);
        expect(isPermanentRequestError(httpError(429))).toBe(false);
        expect(isPermanentRequestError(httpError(500))).toBe(false);
        expect(isPermanentRequestError(new Error('network'))).toBe(false);
    });
});
