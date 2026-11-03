import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApplicationFailure, log } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import { buildThumbnailArgs } from '../renditions/generateVideoRendition.js';
import { ffmpegInputThreadArgs, ffmpegOutputThreadArgs, UNUSABLE_VIDEO_CONTENT } from './exec.js';
import { buildScreenshotArgs } from './video.js';
import {
    allSettledOrThrow,
    buildProbeArgs,
    getSignedVideoUrl,
    HTTP_INPUT_OPTIONS,
    redactVideoInput,
    redactVideoInputError,
    type VideoInput,
    VideoSource,
    videoInputOptions,
} from './videoSource.js';

vi.mock('@temporalio/activity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@temporalio/activity')>()),
    log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../utils/blobs.js', () => ({ saveBlobToTempFile: vi.fn() }));

const SIGNED_URL = 'https://storage.example.com/bucket/video.mp4?X-Signature=secret';
const urlInput: VideoInput = { kind: 'url', url: SIGNED_URL };
const fileInput: VideoInput = { kind: 'file', path: '/tmp/video.mp4' };

function clientWithUrl(getDownloadUrl: () => Promise<{ url: string }>): VertesiaClient {
    return { files: { getDownloadUrl: vi.fn(getDownloadUrl) } } as unknown as VertesiaClient;
}

function runInActivity<T>(fn: () => Promise<T>): Promise<T> {
    return new MockActivityEnvironment().run(fn);
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ffmpeg argument building', () => {
    it('adds reconnect options for a URL input only', () => {
        expect(videoInputOptions(urlInput)).toEqual([...HTTP_INPUT_OPTIONS]);
        expect(videoInputOptions(fileInput)).toEqual([]);
        expect(HTTP_INPUT_OPTIONS).toEqual(
            expect.arrayContaining(['-reconnect', '-reconnect_on_network_error', '-reconnect_streamed']),
        );
        // A 4xx, such as an expired signature, must not be retried.
        expect(HTTP_INPUT_OPTIONS[HTTP_INPUT_OPTIONS.indexOf('-reconnect_on_http_error') + 1]).toBe('5xx');
    });

    it('seeks before the input options and the URL, so the frame is read with range requests', () => {
        const args = buildThumbnailArgs(urlInput, '/out/thumb.jpg', 12.5, 256);

        const seek = args.indexOf('-ss');

        expect(args.slice(seek, seek + 2)).toEqual(['-ss', '12.5']);
        expect(args.slice(seek + 2, seek + 2 + HTTP_INPUT_OPTIONS.length)).toEqual([...HTTP_INPUT_OPTIONS]);
        expect(args.slice(seek + 2 + HTTP_INPUT_OPTIONS.length, seek + 4 + HTTP_INPUT_OPTIONS.length)).toEqual([
            '-i',
            SIGNED_URL,
        ]);
        expect(args.at(-1)).toBe('/out/thumb.jpg');
    });

    it('keeps the local-file thumbnail command unchanged', () => {
        expect(buildThumbnailArgs(fileInput, '/out/thumb.jpg', 3, 256)).toEqual([
            '-y',
            ...ffmpegInputThreadArgs(),
            '-ss',
            '3',
            '-i',
            '/tmp/video.mp4',
            '-vframes',
            '1',
            '-vf',
            'scale=256:256:force_original_aspect_ratio=decrease',
            '-q:v',
            '2',
            ...ffmpegOutputThreadArgs(),
            '/out/thumb.jpg',
        ]);
    });

    it('puts the input options before the probed URL', () => {
        const args = buildProbeArgs(urlInput);

        expect(args.at(-1)).toBe(SIGNED_URL);
        expect(args.slice(-1 - HTTP_INPUT_OPTIONS.length, -1)).toEqual([...HTTP_INPUT_OPTIONS]);
        expect(buildProbeArgs(fileInput).at(-1)).toBe('/tmp/video.mp4');
    });

    it('seeks before the URL for a screenshot', () => {
        const args = buildScreenshotArgs(urlInput, '/out/poster.jpg', 2, { width: 1920, height: 1080 });

        expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
        expect(args.indexOf('-reconnect')).toBeLessThan(args.indexOf('-i'));
        expect(args[args.indexOf('-i') + 1]).toBe(SIGNED_URL);
        expect(args).toContain('scale=1920:1080');
    });
});

describe('redaction', () => {
    it('replaces the signed URL in text', () => {
        expect(redactVideoInput(`Input #0, mov, from '${SIGNED_URL}':`, urlInput)).toBe(
            "Input #0, mov, from '<signed source URL>':",
        );
        expect(redactVideoInput('/tmp/video.mp4', fileInput)).toBe('/tmp/video.mp4');
    });

    it('redacts a command error in place and keeps the flags that mark a stopped activity', () => {
        const error = Object.assign(new Error(`Command failed: ffprobe ${SIGNED_URL}`), {
            cmd: `ffprobe ${SIGNED_URL}`,
            stderr: `${SIGNED_URL}: Server returned 403 Forbidden`,
            killed: true,
        });

        const redacted = redactVideoInputError(error, urlInput) as typeof error;

        expect(redacted).toBe(error);
        expect(redacted.killed).toBe(true);
        for (const text of [redacted.message, redacted.cmd, redacted.stderr, redacted.stack ?? '']) {
            expect(text).not.toContain('secret');
        }
    });
});

describe('getSignedVideoUrl', () => {
    it('signs a storage URI', async () => {
        const client = clientWithUrl(() => Promise.resolve({ url: SIGNED_URL }));

        await expect(getSignedVideoUrl(client, 'gs://bucket/video.mp4')).resolves.toBe(SIGNED_URL);
        expect(client.files.getDownloadUrl).toHaveBeenCalledWith('gs://bucket/video.mp4');
    });

    it('uses an HTTPS source as is', async () => {
        const client = clientWithUrl(() => Promise.reject(new Error('unexpected')));

        await expect(getSignedVideoUrl(client, SIGNED_URL)).resolves.toBe(SIGNED_URL);
        expect(client.files.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('returns undefined when the URL cannot be signed', async () => {
        const client = clientWithUrl(() => Promise.reject(new Error('400 Bad Request')));

        await expect(runInActivity(() => getSignedVideoUrl(client, 'gs://bucket/video.mp4'))).resolves.toBeUndefined();
        expect(log.warn).toHaveBeenCalled();
    });

    it('returns undefined for a URL ffmpeg cannot read over HTTP', async () => {
        const client = clientWithUrl(() => Promise.resolve({ url: 'file:///data/video.mp4' }));

        await expect(getSignedVideoUrl(client, 'gs://bucket/video.mp4')).resolves.toBeUndefined();
    });
});

describe('VideoSource', () => {
    const downloaded = path.join(os.tmpdir(), 'video-source-test.mp4');

    beforeEach(() => {
        vi.mocked(saveBlobToTempFile).mockResolvedValue(downloaded);
    });

    async function openSigned() {
        return await VideoSource.open(
            clientWithUrl(() => Promise.resolve({ url: SIGNED_URL })),
            'gs://bucket/video.mp4',
        );
    }

    it('reads over the URL without downloading when the command succeeds', async () => {
        const source = await openSigned();
        const command = vi.fn((_input: VideoInput) => Promise.resolve('ok'));

        await expect(runInActivity(() => source.withFallback(command))).resolves.toBe('ok');

        expect(command).toHaveBeenCalledWith(urlInput);
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });

    it('downloads and reruns the command when it fails over the URL', async () => {
        const source = await openSigned();
        const command = vi.fn((input: VideoInput) =>
            input.kind === 'url' ? Promise.reject(new Error('HTTP error 403')) : Promise.resolve('local'),
        );

        await expect(runInActivity(() => source.withFallback(command))).resolves.toBe('local');

        expect(command.mock.calls.map(([input]) => input)).toEqual([urlInput, { kind: 'file', path: downloaded }]);
    });

    it('downloads and reruns the command when it produces nothing over the URL', async () => {
        const source = await openSigned();
        const command = vi.fn((input: VideoInput) => Promise.resolve(input.kind === 'url' ? undefined : 'local'));

        await expect(runInActivity(() => source.withFallback(command))).resolves.toBe('local');
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
    });

    it('confirms unusable content on a download before failing permanently', async () => {
        const source = await openSigned();
        const unusable = ApplicationFailure.nonRetryable('No video stream', UNUSABLE_VIDEO_CONTENT);
        const command = vi.fn((_input: VideoInput) => Promise.reject(unusable));

        await expect(runInActivity(() => source.withFallback(command))).rejects.toBe(unusable);
        expect(command.mock.calls.map(([input]) => input)).toEqual([urlInput, { kind: 'file', path: downloaded }]);
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
    });

    it('does not download to retry a killed command', async () => {
        const source = await openSigned();
        const killed = Object.assign(new Error('ffmpeg was still running at the Activity deadline'), {
            killed: true,
            deadlineExceeded: true,
        });

        await expect(runInActivity(() => source.withFallback(() => Promise.reject(killed)))).rejects.toBe(killed);
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });

    it('downloads and reruns a command that stalled reading the URL', async () => {
        const source = await openSigned();
        const stalled = Object.assign(new Error('ffmpeg made no progress'), { killed: true, stalled: true });
        const command = vi.fn((input: VideoInput) =>
            input.kind === 'url' ? Promise.reject(stalled) : Promise.resolve('local'),
        );

        await expect(runInActivity(() => source.withFallback(command))).resolves.toBe('local');
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
    });

    it('downloads once for concurrent fallbacks and for the whole-file commands after them', async () => {
        const source = await openSigned();
        const command = (input: VideoInput) => Promise.resolve(input.kind === 'url' ? undefined : input.path);

        await runInActivity(() => Promise.all([source.withFallback(command), source.withFallback(command)]));
        await expect(source.localInput()).resolves.toEqual({ kind: 'file', path: downloaded });
        // Once downloaded, partial reads use the local copy.
        await expect(source.partialInput()).resolves.toEqual({ kind: 'file', path: downloaded });

        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
    });

    it('downloads up front when no URL can be obtained', async () => {
        const source = await runInActivity(() =>
            VideoSource.open(
                clientWithUrl(() => Promise.reject(new Error('unavailable'))),
                'gs://bucket/video.mp4',
            ),
        );
        const command = vi.fn((_input: VideoInput) => Promise.resolve('local'));

        await expect(runInActivity(() => source.withFallback(command))).resolves.toBe('local');
        expect(command).toHaveBeenCalledExactlyOnceWith({ kind: 'file', path: downloaded });
    });

    it('removes the download on dispose', async () => {
        const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'video-source-')), 'video.mp4');
        fs.writeFileSync(file, 'video');
        vi.mocked(saveBlobToTempFile).mockResolvedValue(file);
        const source = await openSigned();

        await source.localInput();
        await source.dispose();

        expect(fs.existsSync(file)).toBe(false);
    });
});

describe('VideoSource cancellation, disposal and settling', () => {
    it('propagates cancellation while signing instead of falling back to a download', async () => {
        const env = new MockActivityEnvironment();
        const client = clientWithUrl(
            () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('request aborted')), 20)),
        );

        const signing = env.run(() => VideoSource.open(client, 'gs://bucket/video.mp4'));
        env.cancel();

        await expect(signing).rejects.toThrow('request aborted');
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });

    it('refuses to start a download after dispose', async () => {
        const source = await VideoSource.open(
            clientWithUrl(() => Promise.resolve({ url: SIGNED_URL })),
            'gs://bucket/video.mp4',
        );

        await source.dispose();

        await expect(source.localInput()).rejects.toThrow('disposed');
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });

    it('waits for every operation before rejecting with the first failure', async () => {
        let slowSettled = false;
        const slow = new Promise<string>((resolve) =>
            setTimeout(() => {
                slowSettled = true;
                resolve('slow');
            }, 30),
        );

        await expect(allSettledOrThrow([Promise.reject(new Error('first')), slow])).rejects.toThrow('first');
        expect(slowSettled).toBe(true);
        await expect(allSettledOrThrow([Promise.resolve(1), Promise.resolve(2)])).resolves.toEqual([1, 2]);
    });
});

describe('VideoSource URL lifetime', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('signs the URL again once it is more than five minutes old', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        const getDownloadUrl = vi
            .fn()
            .mockResolvedValueOnce({ url: `${SIGNED_URL}&n=1` })
            .mockResolvedValueOnce({ url: `${SIGNED_URL}&n=2` });
        const source = await VideoSource.open(
            { files: { getDownloadUrl } } as unknown as VertesiaClient,
            'gs://bucket/video.mp4',
        );

        now.mockReturnValue(1_000_000 + 4 * 60_000);
        await expect(source.partialInput()).resolves.toEqual({ kind: 'url', url: `${SIGNED_URL}&n=1` });

        now.mockReturnValue(1_000_000 + 6 * 60_000);
        await expect(runInActivity(() => source.partialInput())).resolves.toEqual({
            kind: 'url',
            url: `${SIGNED_URL}&n=2`,
        });
        expect(getDownloadUrl).toHaveBeenCalledTimes(2);
    });

    it('signs an old URL once for concurrent commands', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        const getDownloadUrl = vi
            .fn()
            .mockResolvedValueOnce({ url: `${SIGNED_URL}&n=1` })
            .mockResolvedValueOnce({ url: `${SIGNED_URL}&n=2` });
        const source = await VideoSource.open(
            { files: { getDownloadUrl } } as unknown as VertesiaClient,
            'gs://bucket/video.mp4',
        );

        now.mockReturnValue(1_000_000 + 6 * 60_000);
        const inputs = await runInActivity(() => Promise.all([source.partialInput(), source.partialInput()]));

        expect(inputs).toEqual([
            { kind: 'url', url: `${SIGNED_URL}&n=2` },
            { kind: 'url', url: `${SIGNED_URL}&n=2` },
        ]);
        expect(getDownloadUrl).toHaveBeenCalledTimes(2);
    });

    it('downloads when the URL can no longer be signed', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        const getDownloadUrl = vi
            .fn()
            .mockResolvedValueOnce({ url: SIGNED_URL })
            .mockRejectedValueOnce(new Error('unavailable'));
        vi.mocked(saveBlobToTempFile).mockResolvedValue('/tmp/video.mp4');
        const source = await VideoSource.open(
            { files: { getDownloadUrl } } as unknown as VertesiaClient,
            'gs://bucket/video.mp4',
        );

        now.mockReturnValue(1_000_000 + 6 * 60_000);

        await expect(runInActivity(() => source.partialInput())).resolves.toEqual({
            kind: 'file',
            path: '/tmp/video.mp4',
        });
    });
});
