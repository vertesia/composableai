import { useCallback, useEffect, useRef } from 'react';

/** Largest delay `setTimeout` honours. A longer one fires at once, which would turn into a request loop. */
const MAX_TIMER_MS = 2_147_483_647;

export interface PollingOptions {
    /**
     * Delay after each successful poll. A function is read after every poll, so the cadence can follow
     * the last result (for example a faster check while a run is in progress).
     */
    intervalMs: number | (() => number);
    /** Polling runs only while this is true. Turning it false stops the loop; turning it true restarts it. */
    enabled?: boolean;
    /** Run the first poll at once rather than after one interval. Default true. */
    immediate?: boolean;
    /** While the document is hidden, skip the request and check again at the normal interval. */
    skipWhenHidden?: boolean;
    /**
     * Opt-in backoff for failed polls: the wait doubles from `intervalMs` on each consecutive failure and
     * never exceeds `maxMs`. Without it, failures are retried at the normal interval.
     */
    backoff?: { maxMs: number };
    /**
     * 4xx statuses to treat as transient after all, for a resource that is expected to appear later (for
     * example 404 while a workflow is being created). Off by default: a 404 otherwise ends polling.
     */
    retryStatuses?: readonly number[];
    /** Called after each failed poll. `permanent` is true when polling has stopped because of it. */
    onError?: (err: unknown, permanent: boolean) => void;
}

export interface Polling {
    /**
     * Run one poll now, instead of waiting for the next one. Does nothing while a poll is in flight, and
     * after polling has stopped (finished, or a permanent error) until the loop restarts.
     */
    trigger: () => void;
}

/**
 * True for a 4xx response that the same request will not satisfy on the next try. These are transient, so they
 * are not permanent: 401 (a token refresh can fix it), 408 (timeout) and 429 (rate limit).
 */
export function isPermanentRequestError(err: unknown): boolean {
    const status = (err as { status?: unknown } | null)?.status;
    return typeof status === 'number' && status >= 400 && status < 500 && ![401, 408, 429].includes(status);
}

/** Reads the `retryAfterMs` hint that the API client attaches to its request errors. */
export function retryAfterHintMs(err: unknown): number | undefined {
    const hint = (err as { retryAfterMs?: unknown } | null)?.retryAfterMs;
    return typeof hint === 'number' && Number.isFinite(hint) && hint >= 0 ? hint : undefined;
}

function isPermanentFailure(err: unknown, retryStatuses: readonly number[] | undefined): boolean {
    const status = (err as { status?: unknown } | null)?.status;
    if (typeof status === 'number' && retryStatuses?.includes(status)) return false;
    return isPermanentRequestError(err);
}

/**
 * Runs `task` on a fixed interval until it reports that it is finished, the component unmounts, `enabled`
 * turns false, or a permanent error occurs. The next poll is armed only after the previous one settles, so
 * requests never overlap.
 *
 * `task` resolves `true` when there is nothing left to watch. It may throw; the error decides whether
 * polling stops. Its `signal` aborts when the loop restarts or unmounts, so a task must check it after each
 * `await` before writing state. `deps` restart the loop when they change, like an effect's dependencies.
 * The latest `task` and options are always the ones used, so they need not be in `deps`.
 */
export function usePolling(
    task: (signal: AbortSignal) => Promise<boolean>,
    options: PollingOptions,
    deps: unknown[],
): Polling {
    const taskRef = useRef(task);
    const optionsRef = useRef(options);
    taskRef.current = task;
    optionsRef.current = options;
    const runRef = useRef<(() => void) | undefined>(undefined);
    const enabled = options.enabled ?? true;

    useEffect(() => {
        if (!enabled) return;

        const controller = new AbortController();
        let cancelled = false;
        let stopped = false;
        let inFlight = false;
        let failures = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const readInterval = () => {
            const { intervalMs } = optionsRef.current;
            return typeof intervalMs === 'function' ? intervalMs() : intervalMs;
        };

        const schedule = (delay: number) => {
            timer = setTimeout(() => void run(), Math.min(MAX_TIMER_MS, delay));
        };

        const retryDelay = (err: unknown) => {
            const base = readInterval();
            const { backoff } = optionsRef.current;
            const delay = backoff ? Math.max(base, Math.min(backoff.maxMs, base * 2 ** (failures - 1))) : base;
            return Math.max(delay, retryAfterHintMs(err) ?? 0);
        };

        async function run(): Promise<void> {
            if (cancelled || inFlight) return;
            clearTimeout(timer);
            timer = undefined;
            const opts = optionsRef.current;
            if (opts.skipWhenHidden && document.hidden) {
                schedule(readInterval());
                return;
            }
            inFlight = true;
            try {
                const finished = await taskRef.current(controller.signal);
                if (cancelled) return;
                failures = 0;
                if (finished) {
                    stopped = true;
                    return;
                }
                schedule(readInterval());
            } catch (err) {
                // A request that settles after unmount or a restart must not schedule anything.
                if (cancelled) return;
                const permanent = isPermanentFailure(err, optionsRef.current.retryStatuses);
                optionsRef.current.onError?.(err, permanent);
                if (cancelled) return;
                if (permanent) {
                    stopped = true;
                    return;
                }
                failures += 1;
                schedule(retryDelay(err));
            } finally {
                inFlight = false;
            }
        }

        runRef.current = () => {
            if (stopped) return;
            clearTimeout(timer);
            timer = undefined;
            void run();
        };
        if (optionsRef.current.immediate ?? true) {
            void run();
        } else {
            schedule(readInterval());
        }

        return () => {
            cancelled = true;
            controller.abort();
            clearTimeout(timer);
            runRef.current = undefined;
        };
    }, [enabled, ...deps]);

    const trigger = useCallback(() => runRef.current?.(), []);
    return { trigger };
}
