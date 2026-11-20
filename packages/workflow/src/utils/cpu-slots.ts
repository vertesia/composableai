import os from 'node:os';

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
 * The environment for a command run in a CPU slot: the current environment, with the thread pools of ImageMagick and
 * of OpenMP programs limited to one thread. Left to itself ImageMagick starts one thread per CPU of the host, which in
 * a container is usually far more than the container's CPU limit.
 */
export function cpuSlotEnv(): NodeJS.ProcessEnv {
    return { ...process.env, MAGICK_THREAD_LIMIT: '1', OMP_NUM_THREADS: '1' };
}

/**
 * The CPU slots of the worker process, shared by the CPU-bound commands of every activity: PDF rendering (`mutool`)
 * and ImageMagick. Each activity bounds its own commands, but a worker runs many activities at once, so without a
 * shared bound their commands add up to many times the CPUs the worker has. They then run no faster, every one of them
 * is slower, and the worker's own thread, which answers the health probes, waits behind them for CPU.
 *
 * A slot stands for one CPU, so a command run in a slot must use one thread: start it with {@link cpuSlotEnv}.
 *
 * Each activity attempt has its own queue, keyed by its cancellation signal, which all its commands share. The oldest
 * activity with commands waiting gets every slot but one. The last one, the round-robin slot, goes to the younger
 * activities in turn. So the oldest activity, usually a large PDF, still finishes first, and short commands behind it
 * wait only for the round-robin slot, not for the whole PDF. When only one activity has commands waiting, it gets
 * every slot.
 *
 * Plain round robin between activities would be fairer, but under a burst of large PDFs every one of them would slow
 * down together, and all of them could reach their timeout with none finished. Favouring the oldest lets them finish
 * one after another.
 */
interface ActivityQueue {
    /** Order of the activity's first command, or of the creation of the queue without a signal: lower is older. */
    age: number;
    waiting: Array<() => void>;
    running: number;
    /** When the activity was last given a slot, so the younger activities take turns on the round-robin slot. */
    lastGrant: number;
}

/** The key of the commands run without a signal, outside an activity. */
const NO_ACTIVITY = {};
/**
 * The queue of each activity, kept for the activity's life: its age and its last turn stay while it has nothing waiting
 * or running for a moment, e.g. between its render and upload phases, or between two commands run one after another.
 */
const activityQueues = new WeakMap<object, ActivityQueue>();
/** The queues with commands waiting or running. */
const queues = new Map<object, ActivityQueue>();
let sequence = 0;
let running = 0;
/** With a single slot, whether it last went to the oldest activity with commands waiting, so the others go next. */
let lastGrantToOldest = false;

function queueFor(key: object): ActivityQueue {
    // The commands without a signal get a new queue, and so a new age, each time it empties: they do not stay the
    // oldest once idle.
    let queue = queues.get(key) ?? (key === NO_ACTIVITY ? undefined : activityQueues.get(key));
    if (!queue) {
        queue = { age: ++sequence, waiting: [], running: 0, lastGrant: 0 };
        if (key !== NO_ACTIVITY) {
            activityQueues.set(key, queue);
        }
    }
    queues.set(key, queue);
    return queue;
}

function dropIfIdle(key: object, queue: ActivityQueue) {
    if (queue.waiting.length === 0 && queue.running === 0 && queues.get(key) === queue) {
        queues.delete(key);
    }
}

/** The queue to give the next free slot to, or none when no command is waiting. */
function nextQueue(slots: number): ActivityQueue | undefined {
    let oldest: ActivityQueue | undefined;
    for (const queue of queues.values()) {
        if (queue.waiting.length > 0 && (!oldest || queue.age < oldest.age)) {
            oldest = queue;
        }
    }
    if (!oldest) {
        return undefined;
    }
    // The younger activity served longest ago, the older one first on a tie.
    let younger: ActivityQueue | undefined;
    for (const queue of queues.values()) {
        if (
            queue !== oldest &&
            queue.waiting.length > 0 &&
            (!younger ||
                queue.lastGrant < younger.lastGrant ||
                (queue.lastGrant === younger.lastGrant && queue.age < younger.age))
        ) {
            younger = queue;
        }
    }
    if (!younger) {
        lastGrantToOldest = true;
        return oldest;
    }
    // The round-robin slot is free when no other activity is running a command. With one slot, take turns.
    const roundRobinSlotFree = running === oldest.running;
    const toYounger = slots > 1 ? roundRobinSlotFree : lastGrantToOldest;
    lastGrantToOldest = !toYounger;
    return toYounger ? younger : oldest;
}

/** Give free slots to waiting commands. A running command is never taken away. */
function dispatch() {
    // Follow a CPU limit that changed since the last command.
    const slots = getCpuSlotCount();
    while (running < slots) {
        const queue = nextQueue(slots);
        const grant = queue?.waiting.shift();
        if (!queue || !grant) {
            return;
        }
        queue.running++;
        queue.lastGrant = ++sequence;
        running++;
        grant();
    }
}

/**
 * Run `task` once a CPU slot is free for it, and hold the slot until it settles. `task` should run its commands one
 * after another, and must not wait for another slot. Commands that share `signal` belong to one activity (see
 * {@link ActivityQueue}): pass the activity's cancellation signal.
 *
 * When `signal` aborts while the task is still queued, the returned promise rejects with its reason at once and the
 * task never runs. Once the task has started, it is the task's own job to stop on `signal`.
 */
export async function withCpuSlot<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    const key = signal ?? NO_ACTIVITY;
    const queue = queueFor(key);
    await new Promise<void>((resolve, reject) => {
        const grant = () => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        };
        const onAbort = () => {
            const index = queue.waiting.indexOf(grant);
            if (index >= 0) {
                queue.waiting.splice(index, 1);
                dropIfIdle(key, queue);
                reject(signal?.reason);
            }
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        queue.waiting.push(grant);
        dispatch();
    });
    // The task runs here, not in the dispatcher, so it keeps the caller's async context (its Temporal activity).
    try {
        // Aborted after the slot was given but before the task started: give the slot straight back.
        signal?.throwIfAborted();
        return await task();
    } finally {
        queue.running--;
        running--;
        dropIfIdle(key, queue);
        dispatch();
    }
}

/** Commands running and waiting in the CPU slots, for tests and diagnostics. */
export function cpuSlotUsage(): { active: number; pending: number; slots: number } {
    let pending = 0;
    for (const queue of queues.values()) {
        pending += queue.waiting.length;
    }
    return { active: running, pending, slots: getCpuSlotCount() };
}
