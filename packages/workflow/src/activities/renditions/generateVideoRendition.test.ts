import os from 'node:os';
import path from 'node:path';
import { ApplicationFailure, log } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import { execActivityFile } from '../media/exec.js';
import {
    calculateThumbnailTimestamps,
    generateThumbnailsWithFallback,
    generateVideoRendition,
    getVideoMetadata,
    requireGeneratedThumbnails,
    resolveVideoDuration,
} from './generateVideoRendition.js';

vi.mock('../../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));
vi.mock('../../utils/blobs.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils/blobs.js')>()),
    saveBlobToTempFile: vi.fn(),
}));

vi.mock('@temporalio/activity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@temporalio/activity')>()),
    log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../media/exec.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../media/exec.js')>()),
    execActivityFile: vi.fn(),
    rethrowIfActivityStopped: vi.fn(),
}));

const audioOnlyProbe = {
    stdout: JSON.stringify({ streams: [{ codec_type: 'audio' }], format: { duration: '12' } }),
    stderr: '',
} as Awaited<ReturnType<typeof execActivityFile>>;

describe('generateVideoRendition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fails an audio-only file with UnusableVideoContent and no error log', async () => {
        vi.mocked(setupActivity).mockResolvedValue({
            client: {
                objects: {
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'obj-1',
                        content: { source: 'gs://bucket/audio-only.mp4', type: 'video/mp4', etag: 'etag-1' },
                    }),
                },
            },
            objectId: 'obj-1',
            params: { max_hw: 256, format: 'png' },
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
        vi.mocked(saveBlobToTempFile).mockResolvedValue(path.join(os.tmpdir(), 'missing-audio-only.mp4'));
        vi.mocked(execActivityFile).mockResolvedValue(audioOnlyProbe);

        const failure = await new MockActivityEnvironment()
            .run(generateVideoRendition, {} as Parameters<typeof generateVideoRendition>[0])
            .catch((error: unknown) => error);

        expect(failure).toMatchObject({ type: 'UnusableVideoContent', nonRetryable: true });
        expect(log.warn).toHaveBeenCalledWith('Failed to get video metadata: Video has no usable stream or duration');
        expect(log.error).not.toHaveBeenCalled();
    });
});

describe('getVideoMetadata', () => {
    it('logs a file without a usable video stream at warn, as a content failure', async () => {
        vi.mocked(execActivityFile).mockResolvedValue(audioOnlyProbe);

        const failure = await getVideoMetadata('/tmp/audio-only.mp4').catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(ApplicationFailure);
        expect(failure).toMatchObject({ type: 'UnusableVideoContent', nonRetryable: true });
        expect(log.warn).toHaveBeenCalledWith('Failed to get video metadata: Video has no usable stream or duration');
        expect(log.error).not.toHaveBeenCalled();
    });

    it('logs a probe that cannot run at error', async () => {
        vi.mocked(log.error).mockClear();
        vi.mocked(execActivityFile).mockRejectedValue(new Error('spawn ffprobe ENOENT'));

        await expect(getVideoMetadata('/tmp/video.mp4')).rejects.toThrow('Failed to probe video metadata');

        expect(log.error).toHaveBeenCalledWith('Failed to get video metadata: spawn ffprobe ENOENT');
    });
});

describe('resolveVideoDuration', () => {
    it('prefers the video stream duration over a longer container duration', () => {
        expect(resolveVideoDuration('0.04', '11.971')).toBe(0.04);
    });

    it('falls back to a valid container duration', () => {
        expect(resolveVideoDuration(undefined, '11.971')).toBe(11.971);
    });

    it('rejects non-finite durations', () => {
        expect(resolveVideoDuration('Infinity', 'NaN')).toBe(0);
    });
});

describe('calculateThumbnailTimestamps', () => {
    it('keeps thumbnail seeks within a sub-second video', () => {
        const timestamps = calculateThumbnailTimestamps(0.5, 3);

        expect(timestamps).toHaveLength(3);
        expect(timestamps.every((timestamp) => timestamp > 0 && timestamp < 0.5)).toBe(true);
    });

    it('spaces thumbnails across the usable duration', () => {
        expect(calculateThumbnailTimestamps(100, 3)).toEqual([27.5, 50, 72.5]);
    });
});

describe('generateThumbnailsWithFallback', () => {
    it('retries the first frame when scheduled seeks produce no thumbnails', async () => {
        const generateAt = vi.fn((timestamp: number) =>
            Promise.resolve(timestamp === 0 ? '/tmp/first-frame.jpg' : undefined),
        );

        const thumbnails = await generateThumbnailsWithFallback([3.292, 5.986, 8.679], generateAt);

        expect(thumbnails).toEqual([undefined, undefined, undefined, '/tmp/first-frame.jpg']);
        expect(generateAt.mock.calls.map(([timestamp]) => timestamp)).toEqual([3.292, 5.986, 8.679, 0]);
    });

    it('does not generate a fallback when a scheduled seek succeeds', async () => {
        const generateAt = vi.fn((timestamp: number) => Promise.resolve(`/tmp/${timestamp}.jpg`));

        await generateThumbnailsWithFallback([1, 2], generateAt);

        expect(generateAt).toHaveBeenCalledTimes(2);
    });
});

describe('requireGeneratedThumbnails', () => {
    it('keeps successful thumbnails when some frame extractions fail', () => {
        expect(requireGeneratedThumbnails([undefined, '/tmp/one.jpg', undefined], 'video-id')).toEqual([
            '/tmp/one.jpg',
        ]);
    });

    it('fails permanently instead of reporting success when every extraction fails', () => {
        try {
            requireGeneratedThumbnails([undefined, undefined], 'video-id');
            throw new Error('Expected requireGeneratedThumbnails to throw');
        } catch (error) {
            expect(error).toMatchObject({
                message: 'No thumbnails were generated for video video-id',
                nonRetryable: true,
            });
        }
    });
});
