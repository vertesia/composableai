import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createFfmpegProgressTracker,
    execActivityFile,
    execActivityFileWithProgress,
    ffmpegInputThreadArgs,
    ffmpegOutputThreadArgs,
    isActivityDeadlineExceeded,
    isTranscodeExceedsTimeBudget,
    keepTailLines,
    libx264ThreadArgs,
    projectCompletionMs,
    rethrowIfActivityStopped,
    TRANSCODE_EXCEEDS_TIME_BUDGET,
} from './exec.js';

describe('ffmpeg thread arguments', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sizes decoder, filter and encoder threads to the available CPUs', () => {
        vi.spyOn(os, 'availableParallelism').mockReturnValue(3);

        expect(ffmpegInputThreadArgs()).toEqual(['-filter_threads', '3', '-threads', '3']);
        expect(ffmpegOutputThreadArgs()).toEqual(['-threads', '3']);
    });

    it('applies the libx264 1.5x rule to the available CPUs', () => {
        vi.spyOn(os, 'availableParallelism').mockReturnValue(8);
        expect(libx264ThreadArgs()).toEqual(['-threads', '12']);
    });

    it('never asks for fewer than one thread', () => {
        vi.spyOn(os, 'availableParallelism').mockReturnValue(1);
        expect(libx264ThreadArgs()).toEqual(['-threads', '1']);
        expect(ffmpegOutputThreadArgs()).toEqual(['-threads', '1']);
    });
});

describe('execActivityFile', () => {
    it('should execute a child process inside an Activity context', async () => {
        const testEnv = new MockActivityEnvironment();

        const result = await testEnv.run(() =>
            execActivityFile(process.execPath, ['-e', "process.stdout.write('completed')"]),
        );

        expect(result).toEqual({ stdout: 'completed', stderr: '' });
    });

    it('should terminate the child process when the Activity is cancelled', async () => {
        const testEnv = new MockActivityEnvironment();
        const execution = testEnv.run(() =>
            execActivityFile(process.execPath, ['-e', 'setInterval(() => undefined, 1_000)']),
        );
        const rejection = expect(execution).rejects.toMatchObject({ name: 'AbortError' });

        await new Promise((resolve) => setTimeout(resolve, 100));
        testEnv.cancel();

        await rejection;
    });

    it('should wait for a cancelled child to exit before rejecting', async () => {
        const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'exec-test-')), 'exited');
        const readyMarker = path.join(path.dirname(marker), 'ready');
        const testEnv = new MockActivityEnvironment({ startToCloseTimeoutMs: 60_000 });
        // The child takes a moment to shut down after SIGTERM and writes a marker as it exits.
        const script = `process.on('SIGTERM', () => setTimeout(() => {
            require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'done');
            process.exit(0);
        }, 300));
        setInterval(() => undefined, 1_000);
        require('node:fs').writeFileSync(${JSON.stringify(readyMarker)}, 'ready');`;
        const execution = testEnv.run(() => execActivityFile(process.execPath, ['-e', script]));
        const rejection = expect(execution).rejects.toMatchObject({ name: 'AbortError' });

        try {
            // Cancel only after the child has installed its handler, even on a busy CI runner.
            await vi.waitFor(() => expect(fs.existsSync(readyMarker)).toBe(true), { timeout: 5_000 });
            testEnv.cancel();
            await rejection;

            expect(fs.existsSync(marker)).toBe(true);
        } finally {
            testEnv.cancel();
            await rejection;
            fs.rmSync(path.dirname(marker), { recursive: true, force: true });
        }
    }, 20_000);

    it('should terminate the child process before the Activity StartToClose timeout', async () => {
        const testEnv = new MockActivityEnvironment({
            currentAttemptScheduledTimestampMs: Date.now(),
            startToCloseTimeoutMs: 500,
        });

        const execution = testEnv.run(() =>
            execActivityFile(process.execPath, ['-e', 'setInterval(() => undefined, 1_000)']),
        );

        await expect(execution).rejects.toMatchObject({ killed: true });
    });
});

describe('createFfmpegProgressTracker', () => {
    it('reports advancement only when a monotonic field increases', () => {
        const tracker = createFfmpegProgressTracker();
        expect(tracker.observe('frame=1 time=00:00:00.10\n')).toBe(true);
        expect(tracker.observe('frame=2 time=00:00:00.20\n')).toBe(true);
        // A wedged encoder re-emitting an identical status line must not be mistaken for progress (P1).
        expect(tracker.observe('frame=2 time=00:00:00.20\n')).toBe(false);
        expect(tracker.observe('frame=2 time=00:00:00.20\n')).toBe(false);
    });

    it('advances on time= for audio-only output with no frame= field', () => {
        const tracker = createFfmpegProgressTracker();
        expect(tracker.observe('size=1024kB time=00:00:01.00 bitrate=209.7kbits/s\n')).toBe(true);
        expect(tracker.observe('size=1024kB time=00:00:01.00 bitrate=209.7kbits/s\n')).toBe(false);
        expect(tracker.observe('size=2048kB time=00:00:02.00 bitrate=209.7kbits/s\n')).toBe(true);
    });

    it('recognizes a marker split across stream chunks (P2)', () => {
        const tracker = createFfmpegProgressTracker();
        // No delimiter yet: the partial record is buffered rather than parsed.
        expect(tracker.observe('fra')).toBe(false);
        // Reassembled to `frame=7` once the record completes.
        expect(tracker.observe('me=7\n')).toBe(true);
    });

    it('treats carriage-return-delimited snapshots as complete records', () => {
        const tracker = createFfmpegProgressTracker();
        expect(tracker.observe('frame=1\rframe=2\r')).toBe(true);
        expect(tracker.observe('frame=2\r')).toBe(false);
    });
});

describe('execActivityFileWithProgress', () => {
    const activityEnv = () =>
        new MockActivityEnvironment({
            currentAttemptScheduledTimestampMs: Date.now(),
            startToCloseTimeoutMs: 60_000,
        });

    // Timing-based cases run with generous timeouts so shared-CI CPU contention cannot flake them. The stall window is
    // kept far larger than the progress cadence so a delayed-but-alive child is never mistaken for a wedged one.
    const TIMING_TEST_TIMEOUT_MS = 20_000;

    it(
        'captures output and resolves when the command completes',
        async () => {
            const result = (await activityEnv().run(() =>
                execActivityFileWithProgress(process.execPath, [
                    '-e',
                    "process.stderr.write('frame=1\\n'); process.stdout.write('ok')",
                ]),
            )) as { stdout: string; stderr: string };

            expect(result.stdout).toBe('ok');
            expect(result.stderr).toContain('frame=1');
        },
        TIMING_TEST_TIMEOUT_MS,
    );

    it(
        'terminates a child that reports progress and then stops',
        async () => {
            const execution = activityEnv().run(() =>
                execActivityFileWithProgress(
                    process.execPath,
                    ['-e', "process.stderr.write('frame=1\\n'); setInterval(() => undefined, 1_000)"],
                    { stallTimeoutMs: 300 },
                ),
            );

            await expect(execution).rejects.toMatchObject({ stalled: true, killed: true });
        },
        TIMING_TEST_TIMEOUT_MS,
    );

    it(
        'terminates a child that keeps repeating the same progress line',
        async () => {
            // A wedged encoder that keeps flushing an identical status line must still be detected as stalled (P1).
            const execution = activityEnv().run(() =>
                execActivityFileWithProgress(
                    process.execPath,
                    ['-e', "setInterval(() => process.stderr.write('frame=1 time=00:00:01.00\\n'), 40)"],
                    { stallTimeoutMs: 300 },
                ),
            );

            await expect(execution).rejects.toMatchObject({ stalled: true, killed: true });
        },
        TIMING_TEST_TIMEOUT_MS,
    );

    it(
        'keeps running while the child continues to report progress',
        async () => {
            // Emit progress every 100ms for ~500ms against a 2s stall window: a healthy child must never trip it, even
            // if CI scheduling delays some ticks.
            const script = [
                'let n = 0;',
                'const timer = setInterval(() => {',
                '    process.stderr.write(`frame=${++n}\\n`);',
                '    if (n >= 5) {',
                '        clearInterval(timer);',
                '        process.exit(0);',
                '    }',
                '}, 100);',
            ].join('\n');

            const result = (await activityEnv().run(() =>
                execActivityFileWithProgress(process.execPath, ['-e', script], { stallTimeoutMs: 2_000 }),
            )) as { stdout: string; stderr: string };

            expect(result.stderr).toContain('frame=5');
        },
        TIMING_TEST_TIMEOUT_MS,
    );

    it(
        'rejects with the exit code when the command fails',
        async () => {
            const execution = activityEnv().run(() =>
                execActivityFileWithProgress(process.execPath, ['-e', 'process.exit(3)']),
            );

            await expect(execution).rejects.toMatchObject({ code: 3, killed: false });
        },
        TIMING_TEST_TIMEOUT_MS,
    );

    it(
        'terminates a still-progressing child at the Activity start-to-close deadline',
        async () => {
            // The child keeps reporting advancing progress, so the stall watchdog never fires; the Activity deadline
            // must still terminate it. This exercises a different path than execActivityFile — the spawn timeout, not
            // execFile's timeout.
            const deadlineEnv = new MockActivityEnvironment({
                currentAttemptScheduledTimestampMs: Date.now(),
                startToCloseTimeoutMs: 600,
            });
            const execution = deadlineEnv.run(() =>
                execActivityFileWithProgress(
                    process.execPath,
                    ['-e', 'setInterval(() => process.stderr.write(`frame=${Date.now()}\\n`), 50)'],
                    { stallTimeoutMs: 60_000 },
                ),
            );

            await expect(execution).rejects.toMatchObject({ killed: true });
        },
        TIMING_TEST_TIMEOUT_MS,
    );
});

describe('transcode time budget', () => {
    const activityEnv = () =>
        new MockActivityEnvironment({
            currentAttemptScheduledTimestampMs: Date.now(),
            startToCloseTimeoutMs: 60_000,
        });

    // A child that reports `time=` advancing by one media second every 50ms, i.e. 20x realtime.
    const progressScript = [
        'let s = 0;',
        'const tick = setInterval(() => {',
        '    s += 1;',
        "    process.stderr.write(`frame=${s * 30} time=00:00:${String(s).padStart(2, '0')}.00\\r`);",
        '    if (s >= 10) { clearInterval(tick); process.exit(0); }',
        '}, 50);',
    ].join('\n');

    it('projects the finish time from the share of the media processed', () => {
        expect(projectCompletionMs(60_000, 30, 120)).toBe(240_000);
        expect(projectCompletionMs(60_000, 0, 120)).toBeUndefined();
        // A video without a duration cannot be projected: no budget is judged.
        expect(projectCompletionMs(60_000, 30, 0)).toBeUndefined();
        // Never projects below the time already spent when ffmpeg reports past the probed duration.
        expect(projectCompletionMs(60_000, 150, 120)).toBe(60_000);
    });

    it('stops a command projected to overrun its budget, without retrying', async () => {
        const execution = activityEnv().run(() =>
            execActivityFileWithProgress(process.execPath, ['-e', progressScript], {
                // 1000 media seconds at 20x realtime is about 50s, far over a 1s budget.
                completionBudget: { mediaDurationSeconds: 1000, budgetMs: 1_000, judgeAfterMs: 120 },
            }),
        );

        await expect(execution).rejects.toMatchObject({ type: TRANSCODE_EXCEEDS_TIME_BUDGET, nonRetryable: true });
    }, 20_000);

    it('lets a command on track for its budget finish', async () => {
        const result = (await activityEnv().run(() =>
            execActivityFileWithProgress(process.execPath, ['-e', progressScript], {
                completionBudget: { mediaDurationSeconds: 10, budgetMs: 10_000, judgeAfterMs: 120 },
            }),
        )) as { stderr: string };

        expect(result.stderr).toContain('time=00:00:10.00');
    }, 20_000);

    it('is re-thrown past rendition fallbacks, so it is not swallowed into a missing rendition', async () => {
        const failure = ApplicationFailure.create({ type: TRANSCODE_EXCEEDS_TIME_BUDGET, nonRetryable: true });
        expect(isTranscodeExceedsTimeBudget(failure)).toBe(true);
        await expect(activityEnv().run(async () => rethrowIfActivityStopped(failure))).rejects.toBe(failure);
        await expect(activityEnv().run(async () => rethrowIfActivityStopped(new Error('ffmpeg failed')))).resolves.toBe(
            undefined,
        );
    });
});

describe('activity deadline', () => {
    it('marks a command still progressing at the Activity deadline as deadline-exceeded, not stalled', async () => {
        // A 3s Activity leaves the command about 2.7s; the child keeps reporting progress for far longer.
        const env = new MockActivityEnvironment({
            currentAttemptScheduledTimestampMs: Date.now(),
            startToCloseTimeoutMs: 3_000,
        });
        const script = [
            'let s = 0;',
            'setInterval(() => process.stderr.write(`frame=${++s} time=00:00:0${s % 10}.00\\r`), 50);',
        ].join('\n');

        const failure = await env
            .run(() => execActivityFileWithProgress(process.execPath, ['-e', script]))
            .catch((error: unknown) => error);

        expect(isActivityDeadlineExceeded(failure)).toBe(true);
        expect(failure).toMatchObject({ killed: true });
        expect(failure).not.toHaveProperty('stalled');
    }, 20_000);

    it('does not mark a stall as deadline-exceeded', () => {
        expect(isActivityDeadlineExceeded(Object.assign(new Error('stall'), { killed: true, stalled: true }))).toBe(
            false,
        );
    });
});

describe('execActivityFileWithProgress redaction', () => {
    it('redacts a secret before keeping only the tail of stderr in the error', async () => {
        const secret = `https://storage.example.com/video.mp4?signature=${'s'.repeat(400)}`;
        // The error keeps the last 2000 characters of stderr; place the secret so that boundary falls inside it.
        const script = `process.stderr.write(${JSON.stringify(secret)} + 'x'.repeat(1800)); process.exit(1)`;

        const failure = await new MockActivityEnvironment({ startToCloseTimeoutMs: 60_000 })
            .run(() =>
                execActivityFileWithProgress(process.execPath, ['-e', script], {
                    redact: (text) => text.split(secret).join('<redacted>'),
                }),
            )
            .catch((error: unknown) => error as Error);

        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).not.toContain('sss');
    });
});

describe('keepTailLines', () => {
    it('keeps short text unchanged', () => {
        expect(keepTailLines('one\ntwo', 100)).toBe('one\ntwo');
    });

    it('drops the partial first line of a cut tail', () => {
        expect(keepTailLines('first line\nsecond\nthird', 12)).toBe('third');
        expect(keepTailLines('aaaa\rprogress=1\rprogress=2', 20)).toBe('progress=2');
    });

    it('falls back to a plain cut when the tail has no line break', () => {
        expect(keepTailLines('x'.repeat(10), 4)).toBe('xxxx');
    });
});

describe('execActivityFileWithProgress bounded output', () => {
    it('never retains a secret cut in half when the buffer drops old output', async () => {
        const secret = `https://storage.example.com/video.mp4?signature=${'s'.repeat(200)}`;
        // The buffer keeps the last 150 characters, which would start inside the secret's line.
        const script = `process.stderr.write(${JSON.stringify(`${secret}\nframe=1 done\n`)})`;

        const result = (await new MockActivityEnvironment({ startToCloseTimeoutMs: 60_000 }).run(() =>
            execActivityFileWithProgress(process.execPath, ['-e', script], {
                maxBuffer: 150,
                redact: (text) => text.split(secret).join('<redacted>'),
            }),
        )) as { stderr: string };

        expect(result.stderr).toBe('frame=1 done\n');
    });
});
