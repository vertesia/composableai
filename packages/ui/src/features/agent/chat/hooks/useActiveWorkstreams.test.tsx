import { act, renderHook, waitFor } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { describe, expect, it, vi } from 'vitest';
import { ACTIVE_WORKSTREAMS_POLL_INTERVAL_MS, useActiveWorkstreams } from './useActiveWorkstreams';

function createClient(getActiveWorkstreams: (runId: string) => Promise<unknown>) {
    return {
        agents: { getActiveWorkstreams: vi.fn(getActiveWorkstreams) },
    } as unknown as VertesiaClient;
}

function running(workstreamId: string) {
    return {
        workstream_id: workstreamId,
        launch_id: `launch-${workstreamId}`,
        elapsed_ms: 1,
        deadline_ms: 10,
        status: 'running',
    };
}

describe('useActiveWorkstreams', () => {
    it('clears active and completed when the run changes', async () => {
        const client = createClient(async (runId) =>
            runId === 'run-a'
                ? { running: [running('a')], completed: [running('a-done')] }
                : { running: [], completed: [] },
        );

        const { result, rerender } = renderHook(({ runId }) => useActiveWorkstreams(client, runId, true), {
            initialProps: { runId: 'run-a' },
        });

        await waitFor(() => expect(result.current.active).toHaveLength(1));
        expect(result.current.completed).toHaveLength(1);

        rerender({ runId: 'run-b' });

        await waitFor(() => expect(result.current.active).toEqual([]));
        expect(result.current.completed).toEqual([]);
    });

    it('resets the unavailable latch when the run changes', async () => {
        const client = createClient(async (runId) =>
            runId === 'run-a'
                ? { running: [], completed: [running('a-done')], unavailable: true }
                : { running: [], completed: [] },
        );

        const { result, rerender } = renderHook(({ runId }) => useActiveWorkstreams(client, runId, true), {
            initialProps: { runId: 'run-a' },
        });

        await waitFor(() => expect(result.current.isUnavailable).toBe(true));
        // Latching unavailable also stops polling, which clears `active` — so a run
        // reported unavailable never holds running entries alongside the latch.
        expect(result.current.active).toEqual([]);
        expect(result.current.completed).toHaveLength(1);

        rerender({ runId: 'run-b' });

        await waitFor(() => expect(result.current.isUnavailable).toBe(false));
        expect(result.current.completed).toEqual([]);
    });

    it('surfaces isUnavailable when the server reports the query is unavailable', async () => {
        const client = createClient(async () => ({ running: [], completed: [], unavailable: true }));

        const { result } = renderHook(() => useActiveWorkstreams(client, 'run-a', true));

        await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    });

    it('surfaces isUnavailable and clears active when the request rejects', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const client = createClient(async () => {
            throw new Error('query gone');
        });

        const { result } = renderHook(() => useActiveWorkstreams(client, 'run-a', true));

        await waitFor(() => expect(result.current.isUnavailable).toBe(true));
        expect(result.current.active).toEqual([]);
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('stops polling once unavailable, rather than retrying every interval', async () => {
        vi.useFakeTimers();
        try {
            const client = createClient(async () => ({ running: [], completed: [], unavailable: true }));

            renderHook(() => useActiveWorkstreams(client, 'run-a', true, 1000));

            await act(async () => {
                await Promise.resolve();
            });
            expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(1);

            await act(async () => {
                vi.advanceTimersByTime(5000);
            });
            expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not poll while disabled, and starts when enabled', async () => {
        const client = createClient(async () => ({ running: [running('a')], completed: [] }));

        const { result, rerender } = renderHook(({ enabled }) => useActiveWorkstreams(client, 'run-a', enabled), {
            initialProps: { enabled: false },
        });

        expect(client.agents.getActiveWorkstreams).not.toHaveBeenCalled();

        rerender({ enabled: true });

        await waitFor(() => expect(result.current.active).toHaveLength(1));
    });

    it('clears active but retains completed when polling is switched off', async () => {
        const client = createClient(async () => ({ running: [running('a')], completed: [running('a-done')] }));

        const { result, rerender } = renderHook(({ enabled }) => useActiveWorkstreams(client, 'run-a', enabled), {
            initialProps: { enabled: true },
        });

        await waitFor(() => expect(result.current.active).toHaveLength(1));

        rerender({ enabled: false });

        await waitFor(() => expect(result.current.active).toEqual([]));
        expect(result.current.completed).toHaveLength(1);
    });

    it('polls on the interval given by the fourth argument', async () => {
        vi.useFakeTimers();
        try {
            const client = createClient(async () => ({ running: [], completed: [] }));

            renderHook(() => useActiveWorkstreams(client, 'run-a', true, 1000));

            await act(async () => {
                await Promise.resolve();
            });
            expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(1);

            for (const expected of [2, 3, 4]) {
                await act(async () => {
                    vi.advanceTimersByTime(1000);
                    await Promise.resolve();
                });
                expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(expected);
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it('skips a tick rather than stacking requests while one is still in flight', async () => {
        vi.useFakeTimers();
        try {
            let release: (value: unknown) => void = () => {};
            const client = createClient(
                () =>
                    new Promise((resolve) => {
                        release = resolve;
                    }),
            );

            renderHook(() => useActiveWorkstreams(client, 'run-a', true, 1000));

            await act(async () => {
                await Promise.resolve();
            });
            expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(1);

            // Three ticks pass while the first request is still pending.
            await act(async () => {
                vi.advanceTimersByTime(3000);
                await Promise.resolve();
            });
            expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(1);

            await act(async () => {
                release({ running: [], completed: [] });
                await Promise.resolve();
            });
            await act(async () => {
                vi.advanceTimersByTime(1000);
                await Promise.resolve();
            });
            expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('defaults to the exported poll interval', async () => {
        vi.useFakeTimers();
        try {
            const client = createClient(async () => ({ running: [], completed: [] }));

            renderHook(() => useActiveWorkstreams(client, 'run-a', true));

            await act(async () => {
                await Promise.resolve();
            });
            expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(1);

            await act(async () => {
                vi.advanceTimersByTime(ACTIVE_WORKSTREAMS_POLL_INTERVAL_MS - 1);
                await Promise.resolve();
            });
            expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(1);

            await act(async () => {
                vi.advanceTimersByTime(1);
                await Promise.resolve();
            });
            expect(client.agents.getActiveWorkstreams).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});
