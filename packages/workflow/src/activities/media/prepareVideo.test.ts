import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CancelledFailure, log } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { SourceTooLargeError } from '../../errors.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import { execActivityFile, execActivityFileWithProgress } from './exec.js';
import {
    buildWebRenditionArgs,
    generateScreenshot,
    type PrepareVideoResult,
    prepareVideo,
    resolveVideoPreset,
    screenshotTimestamp,
    shouldTranscodeVideo,
} from './prepareVideo.js';
import {
    buildAudioCopyArgs,
    generateRenditionWithDimensions,
    isAudioCopyEligible,
    isAudioDurationComplete,
    presetAfterDeadline,
    resolvePlaybackDuration,
    type VideoMetadataExtended,
} from './video.js';
import { HTTP_INPUT_OPTIONS, type VideoInput } from './videoSource.js';

vi.mock('@temporalio/activity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@temporalio/activity')>()),
    log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));
vi.mock('../../utils/blobs.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils/blobs.js')>()),
    saveBlobToTempFile: vi.fn(),
}));
// The screenshot fallback test runs the real ffmpeg; every other test drives these mocks.
vi.mock('./exec.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./exec.js')>();
    return {
        ...actual,
        execActivityFile: vi.fn(actual.execActivityFile),
        execActivityFileWithProgress: vi.fn(),
    };
});

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
                limit: 'media',
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

    it('rejects a source the store reports over the limit before reading it over a URL', async () => {
        const getDownloadUrl = vi.fn().mockResolvedValue({ url: 'https://storage.example.com/master.mxf?sig=x' });
        vi.mocked(setupActivity).mockResolvedValue({
            client: {
                files: { getMetadata: vi.fn().mockResolvedValue({ size: 9000 * 1024 * 1024 }), getDownloadUrl },
                objects: {
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'obj-1',
                        content: { source: 'gs://bucket/master.mxf', type: 'application/mxf' },
                    }),
                },
            },
            objectId: 'obj-1',
            params: {},
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
        vi.mocked(saveBlobToTempFile).mockClear();
        vi.mocked(execActivityFile).mockClear();

        const failure = await new MockActivityEnvironment()
            .run(prepareVideo, {} as Parameters<typeof prepareVideo>[0])
            .catch((error: unknown) => error);

        expect(failure).toMatchObject({ type: 'SourceTooLargeError', nonRetryable: true });
        expect(getDownloadUrl).not.toHaveBeenCalled();
        expect(execActivityFile).not.toHaveBeenCalled();
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });
});

describe('buildWebRenditionArgs', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sizes decoding before the input and the libx264 encoder after it', () => {
        vi.spyOn(os, 'availableParallelism').mockReturnValue(4);

        const args = buildWebRenditionArgs('in.mov', 'out.mp4', { width: 1920, height: 1080 }, 'medium');

        const inputIndex = args.indexOf('-i');
        expect(args.slice(1, inputIndex)).toEqual(['-filter_threads', '4', '-threads', '4']);
        const encoderIndex = args.indexOf('libx264');
        expect(args.slice(encoderIndex + 1, encoderIndex + 3)).toEqual(['-threads', '6']);
        expect(args.at(-1)).toBe('out.mp4');
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

const stillVideoMetadata: VideoMetadataExtended = {
    duration: 3,
    width: 64,
    height: 64,
    codec: 'h264',
    bitrate: 1000,
    fps: 1 / 3,
    hasAudio: false,
    formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
    audioStreams: 0,
};
const missingVideo: VideoInput = { kind: 'file', path: 'video.mp4' };

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
            // Commands are killed at the activity's deadline, and the mock's default of one second is too short for two
            // real ffmpeg runs on a busy CI machine.
            const env = new MockActivityEnvironment({ startToCloseTimeoutMs: 60_000 });
            await env.run(async () => {
                const result = await generateScreenshot(
                    { kind: 'file', path: video },
                    dir,
                    1,
                    64,
                    'poster',
                    stillVideoMetadata,
                );
                expect(result?.file).toBe(path.join(dir, 'poster.jpg'));
                expect(fs.statSync(result?.file ?? '').size).toBeGreaterThan(0);
            });
            expect(vi.mocked(execActivityFile).mock.calls.map(([, args]) => args[args.indexOf('-ss') + 1])).toEqual([
                '1',
                '0',
            ]);
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
                env.run(generateScreenshot, missingVideo, dir, 0, 64, 'poster', stillVideoMetadata),
            ).resolves.toBeUndefined();
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
            env.run(generateScreenshot, missingVideo, os.tmpdir(), 1, 64, 'cancel', stillVideoMetadata),
        ).rejects.toBe(error);
        expect(execActivityFile).toHaveBeenCalledOnce();
    });
});

describe('presetAfterDeadline', () => {
    it.each([
        ['veryfast', undefined, 'veryfast'],
        ['veryfast', 'veryfast', 'ultrafast'],
        ['veryfast', 'ultrafast', 'ultrafast'],
        ['medium', 'medium', 'fast'],
        ['medium', 'fast', 'veryfast'],
        ['ultrafast', undefined, 'ultrafast'],
    ] as const)('uses %s after a deadline at %s as %s', (preset, deadlinePreset, expected) => {
        expect(presetAfterDeadline(preset, deadlinePreset)).toBe(expected);
    });
});

describe('prepareVideo audio rendition', () => {
    const SIGNED_URL = 'https://storage.example.com/bucket/video.mp4?X-Signature=secret';
    const downloaded = path.join(os.tmpdir(), 'prepare-video-test-source.mp4');

    function sourceProbe(audio: { codec_name: string; channels: number }) {
        return JSON.stringify({
            streams: [
                { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
                { codec_type: 'audio', duration: '300.0', ...audio },
            ],
            format: { duration: '300.0', bit_rate: '6000000', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
        });
    }

    /** Fake ffmpeg: write the output file named by the last argument. */
    const writeOutput = (args: string[]) => {
        fs.writeFileSync(args[args.length - 1], 'media');
        return Promise.resolve({ stdout: '', stderr: '' });
    };

    function setup(probe: string, copiedDuration = '300.0', skipTranscode = true) {
        vi.mocked(setupActivity).mockResolvedValue({
            client: {
                files: {
                    getDownloadUrl: vi.fn().mockResolvedValue({ url: SIGNED_URL }),
                    uploadFile: vi.fn().mockResolvedValue('gs://bucket/rendition'),
                },
                objects: {
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'obj-1',
                        content: { source: 'gs://bucket/video.mp4', type: 'video/mp4', etag: 'etag-1' },
                    }),
                    update: vi.fn().mockResolvedValue({}),
                },
            },
            objectId: 'obj-1',
            params: { skipTranscode },
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
        vi.mocked(saveBlobToTempFile).mockResolvedValue(downloaded);
        vi.mocked(execActivityFile).mockImplementation((command, args) => {
            if (command === 'ffprobe') {
                return Promise.resolve({
                    stdout: args.includes('format=duration') ? copiedDuration : probe,
                    stderr: '',
                });
            }
            return writeOutput(args);
        });
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => writeOutput(args));
    }

    const run = (): Promise<PrepareVideoResult> =>
        new MockActivityEnvironment().run(prepareVideo, {} as Parameters<typeof prepareVideo>[0]);
    const audioCommands = () => vi.mocked(execActivityFileWithProgress).mock.calls.map(([, args]) => args);
    const successLog = () =>
        vi
            .mocked(log.info)
            .mock.calls.find(([message]) => String(message).startsWith('Successfully prepared video'))?.[1];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('copies an AAC track over the signed URL without downloading or encoding', async () => {
        setup(sourceProbe({ codec_name: 'aac', channels: 2 }));

        const result = await run();

        expect(result.renditions.map((rendition) => rendition.name)).toContain('Audio');
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
        expect(audioCommands()).toHaveLength(1);
        expect(audioCommands()[0]).toEqual(expect.arrayContaining(['-xerror', '-c:a', 'copy', SIGNED_URL]));
        expect(successLog()).toMatchObject({
            audioRendition: 'copy',
            audioCodec: 'aac',
            audioChannels: 2,
            audioStreams: 1,
            container: 'mov,mp4,m4a,3gp,3g2,mj2',
        });
        expect(JSON.stringify(vi.mocked(log.debug).mock.calls)).not.toContain('secret');
    });

    it('copies an AAC track from the download the transcode made', async () => {
        setup(sourceProbe({ codec_name: 'aac', channels: 2 }), '300.0', false);

        const result = await run();
        const [transcode, copy] = audioCommands();

        expect(result.renditions.map((rendition) => rendition.name)).toContain('Audio');
        expect(audioCommands()).toHaveLength(2);
        expect(transcode).toEqual(expect.arrayContaining(['-i', downloaded, '-c:a', 'aac']));
        expect(copy).toEqual(expect.arrayContaining(['-i', downloaded, '-c:a', 'copy']));
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        expect(successLog()).toMatchObject({ audioRendition: 'copy' });
    });

    it('encodes a non-AAC track from the download the transcode made', async () => {
        setup(sourceProbe({ codec_name: 'pcm_s16le', channels: 2 }), '300.0', false);

        await run();
        const [, encode] = audioCommands();

        expect(audioCommands()).toHaveLength(2);
        expect(encode).toEqual(expect.arrayContaining(['-i', downloaded, '-c:a', 'aac']));
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        expect(successLog()).toMatchObject({ audioRendition: 'encode' });
    });

    it('propagates a stopped copy of the downloaded source without encoding it', async () => {
        setup(sourceProbe({ codec_name: 'aac', channels: 2 }), '300.0', false);
        const stopped = Object.assign(new Error('Audio copy stopped'), { killed: true, stalled: true });
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => {
            if (args.includes('copy')) {
                return Promise.reject(stopped);
            }
            return writeOutput(args);
        });

        await expect(run()).rejects.toBe(stopped);

        expect(audioCommands()).toHaveLength(2);
    });

    it('encodes from a download when the copy over the URL stalls', async () => {
        setup(sourceProbe({ codec_name: 'aac', channels: 2 }));
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => {
            if (args.includes(SIGNED_URL)) {
                return Promise.reject(
                    Object.assign(new Error('ffmpeg made no progress'), { killed: true, stalled: true }),
                );
            }
            return writeOutput(args);
        });

        await run();

        expect(audioCommands()[1]).toEqual(expect.arrayContaining(['-i', downloaded, '-c:a', 'aac']));
        expect(successLog()).toMatchObject({ audioRendition: 'encode' });
    });

    it.each([
        { case: 'duration', streams: [{ codec_type: 'video' }] },
        { case: 'video stream', streams: [] },
    ])('retries locally when the URL probe omits the $case', async ({ streams }) => {
        setup(sourceProbe({ codec_name: 'aac', channels: 2 }));
        vi.mocked(execActivityFile).mockResolvedValueOnce({
            stdout: JSON.stringify({ streams, format: {} }),
            stderr: '',
        });

        const result = await run();

        expect(result.metadata.duration).toBe(300);
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        const probes = vi.mocked(execActivityFile).mock.calls.filter(([command]) => command === 'ffprobe');
        expect(probes[0][1].at(-1)).toBe(SIGNED_URL);
        expect(probes[1][1].at(-1)).toBe(downloaded);
    });

    it('keeps a copy shorter than the track states without downloading the source to encode it', async () => {
        // A copy that exits cleanly under -xerror read every packet, as a truncated upload does: an encode would
        // read the same packets.
        setup(sourceProbe({ codec_name: 'aac', channels: 2 }), '78.3');

        await run();

        expect(saveBlobToTempFile).not.toHaveBeenCalled();
        expect(audioCommands()).toEqual([expect.arrayContaining(['-i', SIGNED_URL, '-c:a', 'copy'])]);
        expect(log.warn).toHaveBeenCalledWith(
            'Copied audio track is shorter than the source states; the source holds no more audio',
            { actual: 78.3, expected: 300 },
        );
        expect(successLog()).toMatchObject({ audioRendition: 'copy' });
        expect(log.error).not.toHaveBeenCalled();
    });

    it('encodes from a download when the copy writes no readable audio', async () => {
        setup(sourceProbe({ codec_name: 'aac', channels: 2 }), '');

        await run();

        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        expect(audioCommands()[1]).toEqual(expect.arrayContaining(['-i', downloaded, '-c:a', 'aac']));
        expect(successLog()).toMatchObject({ audioRendition: 'encode' });
    });

    it('encodes from a download when the copy fails', async () => {
        setup(sourceProbe({ codec_name: 'aac', channels: 2 }));
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => {
            if (args.includes(SIGNED_URL)) {
                return Promise.reject(new Error(`Error during demuxing: Input/output error for ${SIGNED_URL}`));
            }
            return writeOutput(args);
        });

        await run();

        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        expect(successLog()).toMatchObject({ audioRendition: 'encode' });
        expect(JSON.stringify(vi.mocked(log.warn).mock.calls)).not.toContain('secret');
    });

    it('encodes from a download without trying a copy when the track is not AAC', async () => {
        setup(sourceProbe({ codec_name: 'pcm_s16le', channels: 2 }));

        await run();

        expect(audioCommands()).toEqual([expect.arrayContaining(['-i', downloaded, '-c:a', 'aac'])]);
        expect(successLog()).toMatchObject({ audioRendition: 'encode', audioCodec: 'pcm_s16le' });
    });

    it('checks an AAC copy from Matroska against the audio track DURATION tag', async () => {
        // The audio track ends 30 s before the container; its length is only in the Matroska tag.
        setup(
            JSON.stringify({
                streams: [
                    { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
                    { codec_type: 'audio', codec_name: 'aac', channels: 2, tags: { DURATION: '00:04:30.000000000' } },
                ],
                format: { duration: '300.0', format_name: 'matroska,webm' },
            }),
            '270.0',
        );

        await run();

        expect(successLog()).toMatchObject({ audioRendition: 'copy' });
    });
});

describe('isAudioCopyEligible', () => {
    const base: VideoMetadataExtended = {
        duration: 300,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 0,
        fps: 30,
        hasAudio: true,
        formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
        audioStreams: 1,
        audioCodec: 'aac',
        audioChannels: 2,
    };

    it.each([
        { case: 'a single mono or stereo AAC track', overrides: {}, expected: true },
        { case: 'mono AAC', overrides: { audioChannels: 1 }, expected: true },
        { case: 'another codec', overrides: { audioCodec: 'mp3' }, expected: false },
        { case: 'surround AAC', overrides: { audioChannels: 6 }, expected: false },
        { case: 'several audio tracks', overrides: { audioStreams: 2 }, expected: false },
        { case: 'an unknown channel count', overrides: { audioChannels: undefined }, expected: false },
    ])('is $expected for $case', ({ overrides, expected }) => {
        expect(isAudioCopyEligible({ ...base, ...overrides })).toBe(expected);
    });
});

describe('isAudioDurationComplete', () => {
    it('accepts a copy within one second or 1% of the source track', () => {
        expect(isAudioDurationComplete(299.98, 300)).toBe(true);
        expect(isAudioDurationComplete(297.5, 300)).toBe(true);
        expect(isAudioDurationComplete(9.2, 10)).toBe(true);
    });

    it('rejects a truncated copy', () => {
        expect(isAudioDurationComplete(78.3, 300)).toBe(false);
        expect(isAudioDurationComplete(296, 300)).toBe(false);
    });
});

describe('buildAudioCopyArgs', () => {
    it('fails on input errors and puts the reconnect options before the URL', () => {
        const url = 'https://storage.example.com/video.mp4?sig=1';
        const args = buildAudioCopyArgs({ kind: 'url', url }, '/out/audio.m4a');

        expect(args).toContain('-xerror');
        expect(args.slice(args.indexOf('-i') - HTTP_INPUT_OPTIONS.length, args.indexOf('-i'))).toEqual([
            ...HTTP_INPUT_OPTIONS,
        ]);
        expect(args.slice(args.indexOf('-i'))).toEqual(['-i', url, '-vn', '-c:a', 'copy', '/out/audio.m4a']);
    });
});

describe('resolvePlaybackDuration', () => {
    const video = { codec_type: 'video' };

    it('prefers the container duration over a shorter stream duration', () => {
        expect(resolvePlaybackDuration({ duration: '11.971' }, { ...video, duration: '11.9' })).toBe(11.971);
    });

    it('falls back to the video stream duration when the container has none', () => {
        expect(resolvePlaybackDuration({}, { ...video, duration: '12.5' })).toBe(12.5);
        expect(resolvePlaybackDuration({ duration: 'N/A' }, { ...video, duration: '12.5' })).toBe(12.5);
    });

    it('reads the Matroska DURATION tag when the stream has no duration field', () => {
        expect(resolvePlaybackDuration({}, { ...video, tags: { DURATION: '01:02:03.500000000' } })).toBe(3723.5);
    });

    it('returns 0 when no duration is usable', () => {
        expect(resolvePlaybackDuration({ duration: '0' }, { ...video, duration: 'NaN', tags: { DURATION: 'x' } })).toBe(
            0,
        );
    });
});

describe('generateRenditionWithDimensions time budget', () => {
    const metadata = (duration: number): VideoMetadataExtended => ({
        duration,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 1,
        fps: 30,
        hasAudio: false,
        formatName: 'matroska,webm',
        audioStreams: 0,
    });
    const encode = async (duration: number) => {
        vi.mocked(execActivityFileWithProgress).mockClear();
        vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => {
            fs.writeFileSync(args[args.length - 1], 'media');
            return Promise.resolve({ stdout: '', stderr: '' });
        });
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rendition-budget-'));
        await new MockActivityEnvironment().run(() =>
            generateRenditionWithDimensions('/tmp/in.webm', outputDir, metadata(duration), 1920, 'veryfast', 3_000_000),
        );
        fs.rmSync(outputDir, { recursive: true, force: true });
        return vi.mocked(execActivityFileWithProgress).mock.calls[0][2];
    };

    it('judges the encode against its budget when the duration is known', async () => {
        await expect(encode(600)).resolves.toEqual({
            completionBudget: { mediaDurationSeconds: 600, budgetMs: 3_000_000 },
        });
    });

    it('does not judge the encode of a video without a duration', async () => {
        await expect(encode(0)).resolves.toEqual({});
    });
});
