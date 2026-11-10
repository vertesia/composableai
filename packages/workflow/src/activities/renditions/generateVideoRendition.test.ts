import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApplicationFailure, log } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import { uploadRenditionPages } from '../../utils/renditions.js';
import { execActivityFile, execActivityFileWithProgress, rethrowIfActivityStopped } from '../media/exec.js';
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
vi.mock('../../utils/renditions.js', () => ({ uploadRenditionPages: vi.fn() }));

vi.mock('@temporalio/activity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@temporalio/activity')>()),
    log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../media/exec.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../media/exec.js')>()),
    execActivityFile: vi.fn(),
    execActivityFileWithProgress: vi.fn(),
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

describe('generateVideoRendition source reads', () => {
    const SIGNED_URL = 'https://storage.example.com/bucket/video.mp4?X-Signature=secret';
    const videoProbe = {
        stdout: JSON.stringify({
            streams: [{ codec_type: 'video', width: 640, height: 360 }],
            format: { duration: '30' },
        }),
        stderr: '',
    } as Awaited<ReturnType<typeof execActivityFile>>;

    function setup(getDownloadUrl: () => Promise<{ url: string }>) {
        vi.mocked(setupActivity).mockResolvedValue({
            client: {
                files: { getDownloadUrl: vi.fn(getDownloadUrl) },
                objects: {
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'obj-1',
                        content: { source: 'gs://bucket/video.mp4', type: 'video/mp4', etag: 'etag-1' },
                    }),
                },
            },
            objectId: 'obj-1',
            params: { max_hw: 256, format: 'jpeg' },
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
        vi.mocked(execActivityFile).mockResolvedValue(videoProbe);
        // ffmpeg writes the frame to its last argument.
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => {
            fs.writeFileSync(args[args.length - 1], 'jpeg');
            return Promise.resolve({ stdout: '', stderr: '' });
        });
        vi.mocked(uploadRenditionPages).mockResolvedValue([]);
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('probes and seeks over the signed URL without downloading the video', async () => {
        setup(() => Promise.resolve({ url: SIGNED_URL }));

        const result = await new MockActivityEnvironment().run(
            generateVideoRendition,
            {} as Parameters<typeof generateVideoRendition>[0],
        );

        expect(result).toMatchObject({ status: 'success', thumbnailCount: 3 });
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
        expect(vi.mocked(execActivityFile).mock.calls[0][1].at(-1)).toBe(SIGNED_URL);
        for (const [, args] of vi.mocked(execActivityFileWithProgress).mock.calls) {
            expect(args[args.indexOf('-i') + 1]).toBe(SIGNED_URL);
        }
        // The signed URL is a read credential; it never reaches the logs.
        for (const call of vi.mocked(log.info).mock.calls) {
            expect(JSON.stringify(call)).not.toContain('secret');
        }
    });

    it('downloads the video when no URL can be signed', async () => {
        setup(() => Promise.reject(new Error('unavailable')));
        const downloaded = path.join(os.tmpdir(), 'missing-video.mp4');
        vi.mocked(saveBlobToTempFile).mockResolvedValue(downloaded);

        await new MockActivityEnvironment().run(
            generateVideoRendition,
            {} as Parameters<typeof generateVideoRendition>[0],
        );

        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        expect(vi.mocked(execActivityFile).mock.calls[0][1].at(-1)).toBe(downloaded);
        expect(vi.mocked(execActivityFile).mock.calls[0][1]).not.toContain('-reconnect');
    });

    it('downloads the video when every frame grab over the URL fails', async () => {
        setup(() => Promise.resolve({ url: SIGNED_URL }));
        const downloaded = path.join(os.tmpdir(), 'missing-video.mp4');
        vi.mocked(saveBlobToTempFile).mockResolvedValue(downloaded);
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => {
            if (args.includes(SIGNED_URL)) {
                return Promise.reject(new Error(`Server returned 403 Forbidden for ${SIGNED_URL}`));
            }
            fs.writeFileSync(args[args.length - 1], 'jpeg');
            return Promise.resolve({ stdout: '', stderr: '' });
        });

        const result = await new MockActivityEnvironment().run(
            generateVideoRendition,
            {} as Parameters<typeof generateVideoRendition>[0],
        );

        expect(result).toMatchObject({ status: 'success', thumbnailCount: 3 });
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        expect(log.error).not.toHaveBeenCalled();
        expect(JSON.stringify(vi.mocked(log.warn).mock.calls)).not.toContain('secret');
    });

    it.each(['error', 'missing output'])('keeps the other URL frames without downloading after %s', async (failure) => {
        setup(() => Promise.resolve({ url: SIGNED_URL }));
        const failedTimestamp = calculateThumbnailTimestamps(30, 3)[1].toString();
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => {
            if (args[args.indexOf('-ss') + 1] === failedTimestamp) {
                return failure === 'error'
                    ? Promise.reject(new Error(`Server returned 403 Forbidden for ${SIGNED_URL}`))
                    : Promise.resolve({ stdout: '', stderr: '' });
            }
            fs.writeFileSync(args[args.length - 1], 'jpeg');
            return Promise.resolve({ stdout: '', stderr: '' });
        });

        const result = await new MockActivityEnvironment().run(
            generateVideoRendition,
            {} as Parameters<typeof generateVideoRendition>[0],
        );

        expect(result).toMatchObject({ status: 'success', thumbnailCount: 2 });
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
        expect(vi.mocked(execActivityFileWithProgress)).toHaveBeenCalledTimes(3);
        expect(log.error).not.toHaveBeenCalled();
    });

    it('grabs every frame from a download when one grab over the URL stalls', async () => {
        setup(() => Promise.resolve({ url: SIGNED_URL }));
        const downloaded = path.join(os.tmpdir(), 'missing-video.mp4');
        vi.mocked(saveBlobToTempFile).mockResolvedValue(downloaded);
        const stalledTimestamp = calculateThumbnailTimestamps(30, 3)[1].toString();
        const actual = await vi.importActual<typeof import('../media/exec.js')>('../media/exec.js');
        vi.mocked(rethrowIfActivityStopped).mockImplementation(actual.rethrowIfActivityStopped);
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => {
            if (args.includes(SIGNED_URL) && args[args.indexOf('-ss') + 1] === stalledTimestamp) {
                return Promise.reject(
                    Object.assign(new Error('ffmpeg made no progress'), { killed: true, stalled: true }),
                );
            }
            fs.writeFileSync(args[args.length - 1], 'jpeg');
            return Promise.resolve({ stdout: '', stderr: '' });
        });

        try {
            const result = await new MockActivityEnvironment().run(
                generateVideoRendition,
                {} as Parameters<typeof generateVideoRendition>[0],
            );

            expect(result).toMatchObject({ status: 'success', thumbnailCount: 3 });
            expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
            const commands = vi.mocked(execActivityFileWithProgress).mock.calls.map(([, args]) => args);
            expect(commands.filter((args) => args.includes(downloaded))).toHaveLength(3);
        } finally {
            vi.mocked(rethrowIfActivityStopped).mockReset();
        }
    });

    it('grabs frame zero over the URL instead of downloading when every seek is past the last frame', async () => {
        setup(() => Promise.resolve({ url: SIGNED_URL }));
        // A half-second clip whose only frames precede every scheduled seek.
        vi.mocked(execActivityFile).mockResolvedValue({
            ...videoProbe,
            stdout: JSON.stringify({
                streams: [{ codec_type: 'video', width: 640, height: 360 }],
                format: { duration: '0.5' },
            }),
        });
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => {
            if (args[args.indexOf('-ss') + 1] !== '0') {
                // Recent ffmpeg (seen on 9) exits non-zero when a seek past the end writes nothing.
                return Promise.reject(new Error('Nothing was written into output file'));
            }
            fs.writeFileSync(args[args.length - 1], 'jpeg');
            return Promise.resolve({ stdout: '', stderr: '' });
        });

        const result = await new MockActivityEnvironment().run(
            generateVideoRendition,
            {} as Parameters<typeof generateVideoRendition>[0],
        );

        expect(result).toMatchObject({ status: 'success', thumbnailCount: 1 });
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
        const commands = vi.mocked(execActivityFileWithProgress).mock.calls.map(([, args]) => args);
        expect(commands).toHaveLength(4);
        expect(commands.at(-1)).toEqual(expect.arrayContaining(['-ss', '0', '-i', SIGNED_URL]));
    });

    it('retries locally when an HTTP probe cannot determine duration', async () => {
        setup(() => Promise.resolve({ url: SIGNED_URL }));
        const downloaded = path.join(os.tmpdir(), 'missing-video.mp4');
        vi.mocked(saveBlobToTempFile).mockResolvedValue(downloaded);
        vi.mocked(execActivityFile).mockResolvedValueOnce({
            stdout: JSON.stringify({ streams: [{ codec_type: 'video' }], format: {} }),
            stderr: '',
        });

        const result = await new MockActivityEnvironment().run(
            generateVideoRendition,
            {} as Parameters<typeof generateVideoRendition>[0],
        );

        expect(result).toMatchObject({ status: 'success', thumbnailCount: 3 });
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        expect(vi.mocked(execActivityFile).mock.calls[1][1].at(-1)).toBe(downloaded);
        expect(log.error).not.toHaveBeenCalled();
    });
});

describe('getVideoMetadata', () => {
    it('logs a file without a usable video stream at warn, as a content failure', async () => {
        vi.mocked(execActivityFile).mockResolvedValue(audioOnlyProbe);

        const failure = await getVideoMetadata({ kind: 'file', path: '/tmp/audio-only.mp4' }).catch(
            (error: unknown) => error,
        );

        expect(failure).toBeInstanceOf(ApplicationFailure);
        expect(failure).toMatchObject({ type: 'UnusableVideoContent', nonRetryable: true });
        expect(log.warn).toHaveBeenCalledWith('Failed to get video metadata: Video has no usable stream or duration');
        expect(log.error).not.toHaveBeenCalled();
    });

    it('logs a probe that cannot run at error', async () => {
        vi.mocked(log.error).mockClear();
        vi.mocked(execActivityFile).mockRejectedValue(new Error('spawn ffprobe ENOENT'));

        await expect(getVideoMetadata({ kind: 'file', path: '/tmp/video.mp4' })).rejects.toThrow(
            'Failed to probe video metadata',
        );

        expect(log.error).toHaveBeenCalledWith('Failed to get video metadata: spawn ffprobe ENOENT');
    });
    it('still accepts the path of a local file', async () => {
        vi.mocked(execActivityFile).mockResolvedValue({
            stdout: JSON.stringify({
                streams: [{ codec_type: 'video', width: 640, height: 360, duration: '12.5' }],
                format: {},
            }),
            stderr: '',
        });

        await expect(getVideoMetadata('/tmp/video.mp4')).resolves.toEqual({ duration: 12.5, width: 640, height: 360 });
        expect(vi.mocked(execActivityFile).mock.calls.at(-1)?.[1].at(-1)).toBe('/tmp/video.mp4');
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

describe('generateThumbnailsWithFallback settling', () => {
    it('lets running frame grabs finish before reporting a stopped one', async () => {
        let siblingFinished = false;
        const generateAt = (timestamp: number) =>
            timestamp === 1
                ? Promise.reject(Object.assign(new Error('ffmpeg made no progress'), { killed: true }))
                : new Promise<string>((resolve) =>
                      setTimeout(() => {
                          siblingFinished = true;
                          resolve('/tmp/2.jpg');
                      }, 30),
                  );

        await expect(generateThumbnailsWithFallback([1, 2], generateAt)).rejects.toThrow('ffmpeg made no progress');
        expect(siblingFinished).toBe(true);
    });
});
