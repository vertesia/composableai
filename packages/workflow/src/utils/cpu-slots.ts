import os from 'node:os';
import pLimit from 'p-limit';

/**
 * How many CPU-bound commands one worker process runs at a time, a positive integer. Defaults to the CPUs the process
 * may use, which honours a container's CPU limit (rounded down).
 */
export const CPU_SLOTS_ENV = 'WORKFLOW_CPU_SLOTS';

/** The number of CPU slots, read on every call: a container's CPU limit can change while the worker runs. */
export function getCpuSlotCount(): number {
    const cpus = Math.max(1, os.availableParallelism());
    const raw = typeof process !== 'undefined' ? process.env?.[CPU_SLOTS_ENV]?.trim() : undefined;
    if (!raw) {
        return cpus;
    }
    // A plain positive integer: anything else keeps the default rather than lifting the limit.
    const slots = /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : 0;
    if (slots <= 0) {
        warnInvalidSlots(raw, cpus);
        return cpus;
    }
    return slots;
}

let warnedValue: string | undefined;
function warnInvalidSlots(raw: string, cpus: number) {
    if (warnedValue !== raw) {
        warnedValue = raw;
        console.warn(`[workflow] Invalid ${CPU_SLOTS_ENV}="${raw}"; expected a positive integer. Using ${cpus}`);
    }
}

/**
 * One queue for the CPU-bound commands of every activity in the worker process: PDF rendering (`mutool`) and
 * ImageMagick. Each activity bounds its own commands, but a worker runs many activities at once, so without a shared
 * bound their commands add up to many times the CPUs the worker has. They then run no faster, every one of them is
 * slower, and the worker's own thread, which answers the health probes, waits behind them for CPU.
 *
 * A slot stands for one CPU, so a command run in a slot must use one thread: start it with {@link cpuSlotEnv}.
 */
const slots = pLimit(getCpuSlotCount());

/**
 * The environment for a command run in a CPU slot: the current environment, with the thread pools of ImageMagick and
 * of OpenMP programs limited to one thread. Left to itself ImageMagick starts one thread per CPU of the host, which in a
 * container is usually far more than the container's CPU limit.
 */
export function cpuSlotEnv(): NodeJS.ProcessEnv {
    return { ...process.env, MAGICK_THREAD_LIMIT: '1', OMP_NUM_THREADS: '1' };
}

/**
 * Run `task` once a CPU slot is free, and hold the slot until it settles. `task` should run its commands one after
 * another, and must not wait for another slot.
 *
 * When `signal` aborts while the task is still queued, the returned promise rejects with its reason at once and the
 * task never runs. Once the task has started, it is the task's own job to stop on `signal`.
 */
export function withCpuSlot<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    // Follow a CPU limit that changed since the last command; p-limit starts queued tasks when it grows.
    slots.concurrency = getCpuSlotCount();
    if (!signal) {
        return slots(task);
    }
    if (signal.aborted) {
        return Promise.reject(signal.reason);
    }
    return new Promise<T>((resolve, reject) => {
        let started = false;
        const onAbort = () => {
            if (!started) {
                reject(signal.reason);
            }
        };
        signal.addEventListener('abort', onAbort, { once: true });
        void slots(async () => {
            if (signal.aborted) {
                return; // Rejected while queued: give the slot straight back.
            }
            started = true;
            // Through a promise, so a task that throws before returning one still settles the caller.
            await Promise.resolve().then(task).then(resolve, reject);
        }).finally(() => signal.removeEventListener('abort', onAbort));
    });
}

/** Commands running and waiting in the CPU slots, for tests and diagnostics. */
export function cpuSlotUsage(): { active: number; pending: number; slots: number } {
    return { active: slots.activeCount, pending: slots.pendingCount, slots: slots.concurrency };
}
