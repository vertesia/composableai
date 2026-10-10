import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CancelledFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { describe, expect, it, vi } from 'vitest';
import { generateScreenshot, resolveVideoPreset, screenshotTimestamp, shouldTranscodeVideo } from './prepareVideo.js';

describe('screenshotTimestamp', () => {
    it.each([0.1, 0.5, 1])('extracts the first frame of a %s-second clip', (duration) => {
        expect(screenshotTimestamp(duration, 0.25)).toBe(0);
        expect(screenshotTimestamp(duration, 0.05, 2)).toBe(0);
    });

    it('keeps seeks inside short clips and preserves positions for longer clips', () => {
        expect(screenshotTimestamp(1.2, 0.25)).toBe(0.6);
        expect(screenshotTimestamp(10, 0.25)).toBe(2.5);
        expect(screenshotTimestamp(100, 0.05, 2)).toBe(2);
    });
});

describe('shouldTranscodeVideo', () => {
    it('transcodes by default', () => {
        expect(shouldTranscodeVideo()).toBe(true);
        expect(shouldTranscodeVideo(false)).toBe(true);
    });

    it('skips transcoding when explicitly requested', () => {
        expect(shouldTranscodeVideo(true)).toBe(false);
    });
});

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

vi.mock('./exec.js', async (importActual) => {
    const actual = await importActual<typeof import('./exec.js')>();
    return { ...actual, execActivityFile: vi.fn(actual.execActivityFile) };
});

import { execActivityFile } from './exec.js';

const stillVideoMetadata = {
    duration: 3,
    width: 64,
    height: 64,
    codec: 'h264',
    bitrate: 1000,
    fps: 1 / 3,
    hasAudio: false,
};

describe('screenshot extraction fallback', () => {
    it('extracts a frame from a three-second one-frame clip after a seek yields no output', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'still-video-'));
        const video = path.join(dir, 'still.mp4');
        vi.mocked(execActivityFile).mockClear();
        try {
            execFileSync(
                'ffmpeg',
                [
                    '-y',
                    '-f',
                    'lavfi',
                    '-i',
                    'color=c=white:s=64x64',
                    '-frames:v',
                    '1',
                    '-r',
                    '1/3',
                    '-c:v',
                    'libx264',
                    '-pix_fmt',
                    'yuvj420p',
                    video,
                ],
                { stdio: 'ignore' },
            );
            const duration = Number(
                execFileSync('ffprobe', [
                    '-v',
                    'error',
                    '-show_entries',
                    'format=duration',
                    '-of',
                    'default=noprint_wrappers=1:nokey=1',
                    video,
                ])
                    .toString()
                    .trim(),
            );
            expect(duration).toBe(3);
            const env = new MockActivityEnvironment();
            await env.run(async () => {
                const result = await generateScreenshot(video, dir, 1, 64, 'poster', stillVideoMetadata);
                expect(result?.file).toBe(path.join(dir, 'poster.jpg'));
                expect(fs.statSync(result?.file ?? '').size).toBeGreaterThan(0);
            });
            expect(vi.mocked(execActivityFile).mock.calls.map((call) => call[1][2])).toEqual(['1', '0']);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('does not retry a missing frame at timestamp zero', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-frame-'));
        vi.mocked(execActivityFile).mockClear().mockResolvedValueOnce({ stdout: '', stderr: '' });
        try {
            const env = new MockActivityEnvironment();
            await expect(
                env.run(generateScreenshot, 'video.mp4', dir, 0, 64, 'poster', stillVideoMetadata),
            ).resolves.toBeNull();
            expect(execActivityFile).toHaveBeenCalledOnce();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('does not retry cancellation as a frame-zero fallback', async () => {
        const error = new CancelledFailure('cancelled');
        const env = new MockActivityEnvironment();
        vi.mocked(execActivityFile)
            .mockClear()
            .mockImplementationOnce(async () => {
                env.cancel();
                throw error;
            });
        await expect(
            env.run(generateScreenshot, 'video.mp4', os.tmpdir(), 1, 64, 'cancel', stillVideoMetadata),
        ).rejects.toBe(error);
        expect(execActivityFile).toHaveBeenCalledOnce();
    });
});
