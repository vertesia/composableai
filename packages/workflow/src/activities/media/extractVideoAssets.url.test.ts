import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { log } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import { execActivityFile, execActivityFileWithProgress } from './exec.js';
import { extractVideoAssets } from './extractVideoAssets.js';
import type { PrepareVideoResult } from './prepareVideo.js';
import { transcodeVideo } from './transcodeVideo.js';

vi.mock('@temporalio/activity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@temporalio/activity')>()),
    log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));
vi.mock('../../utils/blobs.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils/blobs.js')>()),
    saveBlobToTempFile: vi.fn(),
}));
vi.mock('./exec.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./exec.js')>()),
    execActivityFile: vi.fn(),
    execActivityFileWithProgress: vi.fn(),
}));

const SIGNED_URL = 'https://storage.example.com/bucket/video.mp4?X-Signature=secret';
const downloaded = path.join(os.tmpdir(), 'extract-video-assets-test-source.mp4');

function sourceProbe(audioCodec: string) {
    return JSON.stringify({
        streams: [
            { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
            { codec_type: 'audio', codec_name: audioCodec, channels: 2, duration: '300.0' },
        ],
        format: { duration: '300.0', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
    });
}

/** Fake ffmpeg: write the output file named by the last argument. */
const writeOutput = (args: string[]) => {
    fs.writeFileSync(args[args.length - 1], 'media');
    return Promise.resolve({ stdout: '', stderr: '' });
};

function setup(audioCodec: string, probe = sourceProbe(audioCodec)) {
    const client = {
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
    };
    vi.mocked(setupActivity).mockResolvedValue({
        client,
        objectId: 'obj-1',
        params: {},
    } as unknown as Awaited<ReturnType<typeof setupActivity>>);
    vi.mocked(saveBlobToTempFile).mockResolvedValue(downloaded);
    vi.mocked(execActivityFile).mockImplementation((command, args) => {
        if (command === 'ffprobe') {
            return Promise.resolve({
                stdout: args.includes('format=duration') ? '300.0' : probe,
                stderr: '',
            });
        }
        return writeOutput(args);
    });
    vi.mocked(execActivityFileWithProgress).mockImplementation((_command, args) => writeOutput(args));
    return client;
}

const ffmpegCalls = () => [
    ...vi.mocked(execActivityFile).mock.calls.filter(([command]) => command === 'ffmpeg'),
    ...vi.mocked(execActivityFileWithProgress).mock.calls,
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe('extractVideoAssets', () => {
    it('reads an AAC source over its signed URL without downloading it', async () => {
        setup('aac');

        const result = (await new MockActivityEnvironment().run(
            extractVideoAssets,
            {} as Parameters<typeof extractVideoAssets>[0],
        )) as PrepareVideoResult;

        expect(result.renditions.map((rendition) => rendition.name)).toEqual(['Poster', 'Audio']);
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
        // Probe, poster, thumbnail and audio copy all read the URL.
        for (const [, args] of ffmpegCalls()) {
            expect(args).toContain(SIGNED_URL);
        }
        expect(ffmpegCalls().some(([, args]) => args.includes('copy'))).toBe(true);
        const extracted = vi
            .mocked(log.info)
            .mock.calls.find(([message]) => String(message).startsWith('Extracted video assets'));
        expect(extracted?.[1]).toMatchObject({ audioRendition: 'copy', audioCodec: 'aac' });
        expect(JSON.stringify(vi.mocked(log.debug).mock.calls)).not.toContain('secret');
    });

    it('downloads the source only to encode audio that cannot be copied', async () => {
        setup('pcm_s16le');

        await new MockActivityEnvironment().run(extractVideoAssets, {} as Parameters<typeof extractVideoAssets>[0]);

        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        const encode = vi.mocked(execActivityFileWithProgress).mock.calls.map(([, args]) => args);
        expect(encode).toEqual([expect.arrayContaining(['-i', downloaded, '-c:a', 'aac'])]);
    });
});

describe('extractVideoAssets without a duration', () => {
    // Browser-recorded WebM often states no duration, in the container or in its streams.
    const durationlessWebm = (audioCodec: string) =>
        JSON.stringify({
            streams: [
                { codec_type: 'video', codec_name: 'vp8', width: 1280, height: 720, r_frame_rate: '30/1' },
                { codec_type: 'audio', codec_name: audioCodec, channels: 2 },
            ],
            format: { format_name: 'matroska,webm' },
        });
    const run = async () =>
        (await new MockActivityEnvironment().run(
            extractVideoAssets,
            {} as Parameters<typeof extractVideoAssets>[0],
        )) as PrepareVideoResult;

    it('processes the video with a zero duration after confirming it on the download', async () => {
        setup('opus', durationlessWebm('opus'));

        const result = await run();

        expect(result.metadata.duration).toBe(0);
        expect(result.renditions.map((rendition) => rendition.name)).toEqual(['Poster', 'Audio']);
        // The URL probe found no duration, so the probe was repeated on the download.
        const probes = vi.mocked(execActivityFile).mock.calls.filter(([command]) => command === 'ffprobe');
        expect(probes.map(([, args]) => args.at(-1))).toEqual([SIGNED_URL, downloaded]);
        expect(log.error).not.toHaveBeenCalled();
    });

    it('encodes an AAC track instead of copying it when there is no duration to check the copy against', async () => {
        setup('aac', durationlessWebm('aac'));

        const result = await run();

        expect(result.renditions.map((rendition) => rendition.name)).toContain('Audio');
        expect(ffmpegCalls().some(([, args]) => args.includes('copy'))).toBe(false);
        const extracted = vi
            .mocked(log.info)
            .mock.calls.find(([message]) => String(message).startsWith('Extracted video assets'));
        expect(extracted?.[1]).toMatchObject({ audioRendition: 'encode' });
    });
});

describe('transcodeVideo', () => {
    it('downloads the source and probes the local copy, without signing a URL', async () => {
        const client = setup('aac');

        await new MockActivityEnvironment().run(transcodeVideo, {} as Parameters<typeof transcodeVideo>[0]);

        expect(client.files.getDownloadUrl).not.toHaveBeenCalled();
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        const probe = vi.mocked(execActivityFile).mock.calls.find(([command]) => command === 'ffprobe');
        expect(probe?.[1].at(-1)).toBe(downloaded);
    });
});
