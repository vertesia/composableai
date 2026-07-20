import { MockActivityEnvironment } from '@temporalio/testing';
import { describe, expect, it } from 'vitest';
import { execActivityFile, resolveVideoPreset } from './prepareVideo.js';

describe('resolveVideoPreset', () => {
    it.each([
        { preset: 'medium', attempt: 1, expected: 'medium' },
        { preset: 'medium', attempt: 2, expected: 'fast' },
        { preset: 'medium', attempt: 3, expected: 'veryfast' },
        { preset: 'medium', attempt: 5, expected: 'veryfast' },
        { preset: 'fast', attempt: 1, expected: 'fast' },
        { preset: 'fast', attempt: 2, expected: 'veryfast' },
        { preset: 'ultrafast', attempt: 2, expected: 'ultrafast' },
    ] as const)('uses $expected for $preset on attempt $attempt', ({ preset, attempt, expected }) => {
        expect(resolveVideoPreset(preset, attempt)).toBe(expected);
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
