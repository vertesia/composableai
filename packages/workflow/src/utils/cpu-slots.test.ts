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

    it('gives the slot straight back when the signal aborts after the slot was given', async () => {
        process.env[CPU_SLOTS_ENV] = '1';
        const g = gate();
        const busy = withCpuSlot(g.task);
        await tick();
        const controller = new AbortController();
        let ran = false;
        const queued = withCpuSlot(async () => {
            ran = true;
        }, controller.signal);
        // The released command frees its slot and gives it to the queued one before this abort runs.
        g.releaseAll();
        queueMicrotask(() => controller.abort(new Error('late')));
        await expect(queued).rejects.toThrow('late');
        await busy;
        await tick();
        expect(ran).toBe(false);
        expect(cpuSlotUsage()).toMatchObject({ active: 0, pending: 0 });
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

    describe('sharing between activities: oldest first, plus the round-robin slot', () => {
        const NO_SIGNAL = 'no signal';
        // The scheduler is shared by the whole file: free its slots even when a test fails part way.
        let drainLast: (() => Promise<void>) | undefined;
        afterEach(async () => {
            await drainLast?.();
            drainLast = undefined;
        });

        /**
         * Activities that each queue commands under their own signal, and the commands running for each. Commands of
         * {@link NO_SIGNAL} are queued without a signal.
         */
        function activities(...names: string[]) {
            const running: string[] = [];
            const releases: Array<{ name: string; release: () => void }> = [];
            const signals = new Map(
                names.map((name) => [name, name === NO_SIGNAL ? undefined : new AbortController().signal]),
            );
            const done: Array<Promise<void>> = [];
            const queue = (name: string, count: number) => {
                for (let i = 0; i < count; i++) {
                    const task = () =>
                        new Promise<void>((resolve) => {
                            running.push(name);
                            releases.push({
                                name,
                                release: () => {
                                    running.splice(running.indexOf(name), 1);
                                    resolve();
                                },
                            });
                        });
                    done.push(withCpuSlot(task, signals.get(name)));
                }
            };
            /** Finish the oldest running command of `name`, and let the freed slot be given out. */
            const finish = async (name: string) => {
                const index = releases.findIndex((r) => r.name === name);
                if (index < 0) {
                    throw new Error(`No command of ${name} is running`);
                }
                releases.splice(index, 1)[0].release();
                await tick();
            };
            const count = (name: string) => running.filter((n) => n === name).length;
            const drain = async () => {
                while (releases.length > 0) {
                    releases.shift()?.release();
                    await tick();
                }
                await Promise.all(done);
            };
            drainLast = drain;
            return { queue, finish, count, drain, running };
        }

        it('gives all 3 slots to a lone activity', async () => {
            process.env[CPU_SLOTS_ENV] = '3';
            const a = activities('pdf');
            a.queue('pdf', 10);
            await tick();
            expect(a.count('pdf')).toBe(3);
            await a.drain();
        });

        it('gives the oldest activity every slot but one, and the round-robin slot to a younger one', async () => {
            process.env[CPU_SLOTS_ENV] = '3';
            const a = activities('pdf', 'resize');
            a.queue('pdf', 20);
            await tick();
            a.queue('resize', 5);
            await tick();
            expect(a.count('resize')).toBe(0); // Slots already running are not taken away.
            await a.finish('pdf');
            expect([a.count('pdf'), a.count('resize')]).toEqual([2, 1]);
            for (let i = 0; i < 4; i++) {
                await a.finish('pdf');
                expect([a.count('pdf'), a.count('resize')]).toEqual([2, 1]);
                await a.finish('resize');
                expect([a.count('pdf'), a.count('resize')]).toEqual([2, 1]);
            }
            await a.drain();
        });

        it('lets the younger activities take turns on the round-robin slot', async () => {
            process.env[CPU_SLOTS_ENV] = '2';
            const a = activities('pdf', 'first', 'second');
            a.queue('pdf', 20);
            await tick();
            a.queue('first', 3);
            a.queue('second', 3);
            await a.finish('pdf');
            const turns = [a.running.find((n) => n !== 'pdf')];
            for (let i = 0; i < 3; i++) {
                await a.finish(turns[turns.length - 1] as string);
                turns.push(a.running.find((n) => n !== 'pdf'));
            }
            expect(turns).toEqual(['first', 'second', 'first', 'second']);
            expect(a.count('pdf')).toBe(1);
            await a.drain();
        });

        it('takes turns between the oldest activity and the others with one slot', async () => {
            process.env[CPU_SLOTS_ENV] = '1';
            const a = activities('pdf', 'resize');
            a.queue('pdf', 5);
            await tick();
            a.queue('resize', 5);
            const turns: string[] = [];
            for (let i = 0; i < 4; i++) {
                const name = a.running[0];
                turns.push(name);
                await a.finish(name);
            }
            expect(turns).toEqual(['pdf', 'resize', 'pdf', 'resize']);
            await a.drain();
        });

        it('keeps an activity the oldest when its queue empties for a moment', async () => {
            process.env[CPU_SLOTS_ENV] = '3';
            const a = activities('pdf', 'resize');
            a.queue('pdf', 3);
            await tick();
            a.queue('resize', 20);
            // Between its render and upload phases, the PDF has nothing queued or running.
            for (let i = 0; i < 3; i++) {
                await a.finish('pdf');
            }
            expect(a.count('resize')).toBe(3);
            a.queue('pdf', 20);
            for (let i = 0; i < 3; i++) {
                await a.finish('resize');
            }
            expect([a.count('pdf'), a.count('resize')]).toEqual([2, 1]);
            await a.drain();
        });

        it('keeps the turn of a younger activity that queues one command at a time', async () => {
            process.env[CPU_SLOTS_ENV] = '3';
            const a = activities('pdf', 'first', 'second', 'third');
            a.queue('pdf', 20);
            await tick();
            a.queue('first', 1);
            a.queue('second', 1);
            a.queue('third', 5);
            await a.finish('pdf');
            expect(a.count('first')).toBe(1);
            // Each of the first two queues its next command only once the last one is done, so its queue empties.
            await a.finish('first');
            expect(a.count('second')).toBe(1);
            a.queue('first', 1);
            await a.finish('second');
            a.queue('second', 1);
            // The third has waited longest: it goes next, not the first, whose queue was empty for a moment.
            expect(a.count('third')).toBe(1);
        });

        it('gives the commands without a signal a new age each time their queue empties', async () => {
            process.env[CPU_SLOTS_ENV] = '3';
            const a = activities(NO_SIGNAL, 'pdf');
            a.queue(NO_SIGNAL, 3);
            await tick();
            a.queue('pdf', 20);
            for (let i = 0; i < 3; i++) {
                await a.finish(NO_SIGNAL);
            }
            expect(a.count('pdf')).toBe(3);
            a.queue(NO_SIGNAL, 20);
            // Younger than the PDF now: they get the round-robin slot only.
            for (let i = 0; i < 2; i++) {
                await a.finish('pdf');
                expect([a.count('pdf'), a.count(NO_SIGNAL)]).toEqual([2, 1]);
            }
        });
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
