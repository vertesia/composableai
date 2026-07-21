import { MockActivityEnvironment } from '@temporalio/testing';
import { describe, expect, it } from 'vitest';
import { createFfmpegProgressTracker, execActivityFile, execActivityFileWithProgress } from './exec.js';

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
});
