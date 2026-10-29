import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CancelledFailure, log } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { describe, expect, it, vi } from 'vitest';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { SourceTooLargeError } from '../../errors.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import {
    generateScreenshot,
    prepareVideo,
    resolveVideoPreset,
    screenshotTimestamp,
    shouldTranscodeVideo,
} from './prepareVideo.js';

vi.mock('@temporalio/activity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@temporalio/activity')>()),
    log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));
vi.mock('../../utils/blobs.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils/blobs.js')>()),
    saveBlobToTempFile: vi.fn(),
}));

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

describe('prepareVideo', () => {
    it('fails an audio-only file with UnusableVideoContent and no error log', async () => {
        vi.mocked(setupActivity).mockResolvedValue({
            client: {
                objects: {
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'obj-1',
                        content: { source: 'gs://bucket/audio-only.mp4', type: 'video/mp4' },
                    }),
                },
            },
            objectId: 'obj-1',
            params: {},
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
        vi.mocked(saveBlobToTempFile).mockResolvedValue(path.join(os.tmpdir(), 'missing-audio-only.mp4'));
        vi.mocked(execActivityFile)
            .mockClear()
            .mockResolvedValueOnce({
                stdout: JSON.stringify({ streams: [{ codec_type: 'audio' }], format: { duration: '12' } }),
                stderr: '',
            } as Awaited<ReturnType<typeof execActivityFile>>);

        const failure = await new MockActivityEnvironment()
            .run(prepareVideo, {} as Parameters<typeof prepareVideo>[0])
            .catch((error: unknown) => error);

        expect(failure).toMatchObject({
            message: 'No video stream found in file',
            type: 'UnusableVideoContent',
            nonRetryable: true,
        });
        expect(log.warn).toHaveBeenCalledWith('Failed to get video metadata: No video stream found in file');
        expect(log.error).not.toHaveBeenCalled();
    });
});

describe('prepareVideo source limits', () => {
    function mockObject(type: string) {
        vi.mocked(setupActivity).mockResolvedValue({
            client: {
                objects: {
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'obj-1',
                        content: { source: 'gs://bucket/master.mxf', type },
                    }),
                },
            },
            objectId: 'obj-1',
            params: {},
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
    }

    it('accepts an MXF video and downloads it with the media size limit', async () => {
        mockObject('application/mxf');
        vi.mocked(saveBlobToTempFile).mockClear().mockRejectedValue(new Error('stop after the download call'));

        await expect(
            new MockActivityEnvironment().run(prepareVideo, {} as Parameters<typeof prepareVideo>[0]),
        ).rejects.toThrow('stop after the download call');

        expect(saveBlobToTempFile).toHaveBeenCalledExactlyOnceWith(
            expect.anything(),
            'gs://bucket/master.mxf',
            undefined,
            {
                maxBytes: 8192 * 1024 * 1024,
            },
        );
    });

    it('fails a source over the limit without retrying', async () => {
        mockObject('application/mxf');
        vi.mocked(log.error).mockClear();
        vi.mocked(saveBlobToTempFile)
            .mockClear()
            .mockRejectedValue(new SourceTooLargeError('gs://bucket/master.mxf', 10, 50));

        const failure = await new MockActivityEnvironment()
            .run(prepareVideo, {} as Parameters<typeof prepareVideo>[0])
            .catch((error: unknown) => error);

        expect(failure).toMatchObject({ type: 'SourceTooLargeError', nonRetryable: true });
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
    it('defaults to veryfast', () => {
        expect(resolveVideoPreset()).toBe('veryfast');
    });

    it.each(['medium', 'fast', 'veryfast', 'ultrafast'] as const)('keeps the requested %s preset', (preset) => {
        expect(resolveVideoPreset(preset)).toBe(preset);
    });

    it('rejects an unknown preset without retrying', () => {
        expect(() => resolveVideoPreset('slow')).toThrow(
            expect.objectContaining({ type: 'InvalidVideoPreset', nonRetryable: true }),
        );
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
