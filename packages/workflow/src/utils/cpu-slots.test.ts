import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CPU_SLOTS_ENV, cpuSlotEnv, cpuSlotUsage, getCpuSlotCount, withCpuSlot } from './cpu-slots.js';

/** A task that runs until `release` is called, counting how many such tasks run at once. */
function gate() {
    let running = 0;
    let highWater = 0;
    const releases: Array<() => void> = [];
    const task = () =>
        new Promise<void>((resolve) => {
            running++;
            highWater = Math.max(highWater, running);
            releases.push(() => {
                running--;
                resolve();
            });
        });
    return {
        task,
        releaseAll: () => {
            for (const release of releases.splice(0)) {
                release();
            }
        },
        get running() {
            return running;
        },
        get highWater() {
            return highWater;
        },
    };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('withCpuSlot', () => {
    let previous: string | undefined;
    beforeEach(() => {
        previous = process.env[CPU_SLOTS_ENV];
        process.env[CPU_SLOTS_ENV] = '2';
    });
    afterEach(() => {
        if (previous === undefined) {
            delete process.env[CPU_SLOTS_ENV];
        } else {
            process.env[CPU_SLOTS_ENV] = previous;
        }
    });

    it('runs no more tasks at once than there are slots, across callers', async () => {
        const g = gate();
        // Two activities, each bounding itself to 5, share the 2 slots.
        const all = Promise.all(Array.from({ length: 10 }, () => withCpuSlot(g.task, new AbortController().signal)));
        for (let i = 0; i < 5; i++) {
            await tick();
            expect(g.running).toBeLessThanOrEqual(2);
            g.releaseAll();
        }
        await all;
        await tick(); // A slot is given back just after its task settles.
        expect(g.highWater).toBe(2);
        expect(cpuSlotUsage()).toMatchObject({ active: 0, pending: 0 });
    });

    it('rejects a queued task at once when its signal aborts, and never runs it', async () => {
        const g = gate();
        const busy = [withCpuSlot(g.task), withCpuSlot(g.task)];
        await tick();
        const controller = new AbortController();
        let ran = false;
        const queued = withCpuSlot(async () => {
            ran = true;
        }, controller.signal);
        controller.abort(new Error('stopping'));
        await expect(queued).rejects.toThrow('stopping');
        g.releaseAll();
        await Promise.all(busy);
        await tick();
        expect(ran).toBe(false);
        expect(cpuSlotUsage()).toMatchObject({ active: 0, pending: 0 });
    });

    it('waits for a started task when its signal aborts', async () => {
        const g = gate();
        const controller = new AbortController();
        let settled = false;
        const started = withCpuSlot(g.task, controller.signal).then(() => {
            settled = true;
        });
        await tick();
        controller.abort();
        await tick();
        expect(settled).toBe(false);
        g.releaseAll();
        await started;
        expect(settled).toBe(true);
    });

    it('rejects without queueing when the signal has already aborted', async () => {
        const controller = new AbortController();
        controller.abort(new Error('gone'));
        await expect(withCpuSlot(async () => 1, controller.signal)).rejects.toThrow('gone');
    });

    it('follows a slot count that grows while tasks are queued', async () => {
        process.env[CPU_SLOTS_ENV] = '1';
        const g = gate();
        const first = [withCpuSlot(g.task), withCpuSlot(g.task), withCpuSlot(g.task)];
        await tick();
        expect(g.running).toBe(1);
        process.env[CPU_SLOTS_ENV] = '3';
        const last = withCpuSlot(g.task);
        await tick();
        expect(g.running).toBe(3);
        g.releaseAll();
        await tick();
        g.releaseAll();
        await Promise.all([...first, last]);
    });

    it('settles the caller when a task throws before returning a promise', async () => {
        const task = (() => {
            throw new Error('sync');
        }) as unknown as () => Promise<void>;
        await expect(withCpuSlot(task, new AbortController().signal)).rejects.toThrow('sync');
        await expect(withCpuSlot(task)).rejects.toThrow('sync');
    });

    it.each([
        ['', 'unset'],
        ['0', 'zero'],
        ['2 cpus', 'not an integer'],
    ])('uses the CPUs the process may use when the setting is %j (%s)', (value) => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        process.env[CPU_SLOTS_ENV] = value;
        expect(getCpuSlotCount()).toBe(Math.max(1, os.availableParallelism()));
        vi.restoreAllMocks();
    });

    it('limits ImageMagick and OpenMP to one thread', () => {
        expect(cpuSlotEnv()).toMatchObject({ MAGICK_THREAD_LIMIT: '1', OMP_NUM_THREADS: '1' });
        expect(cpuSlotEnv().PATH).toBe(process.env.PATH);
    });
});
