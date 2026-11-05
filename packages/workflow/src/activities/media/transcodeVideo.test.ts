import { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { SOURCE_TOO_LARGE_ERROR } from '../../errors.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import { TRANSCODE_EXCEEDS_TIME_BUDGET } from './exec.js';
import {
    estimateRenditionBytes,
    estimateTranscodeDiskBytes,
    estimateTranscodeMs,
    sourceUrlTtlSeconds,
    TRANSCODE_EXCEEDS_DISK_BUDGET,
    TRANSCODE_SOURCE_URL_FAILED,
    transcodeDiskBudgetBytes,
    transcodeRealtimeFactor,
    transcodeVideo,
} from './transcodeVideo.js';
import * as video from './video.js';
import type { VideoInput } from './videoSource.js';

vi.mock('../../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));
vi.mock('../../utils/blobs.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../utils/blobs.js')>()),
    saveBlobToTempFile: vi.fn(),
    removeTempFiles: vi.fn(),
}));
vi.mock('./video.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./video.js')>();
    return {
        ...actual,
        retrieveVideoObject: vi.fn(),
        probeVideoSource: vi.fn(),
        generateRenditionWithDimensions: vi.fn(),
        uploadWebRendition: vi.fn(),
    };
});

const GiB = 1024 ** 3;

describe('transcodeDiskBudgetBytes', () => {
    it('leaves headroom below the configured ephemeral storage', () => {
        expect(transcodeDiskBudgetBytes({ WORKER_EPHEMERAL_STORAGE_BYTES: String(20 * GiB) })).toBe(19 * GiB);
    });

    it('has no budget when the worker does not state its storage', () => {
        expect(transcodeDiskBudgetBytes({})).toBeUndefined();
        expect(transcodeDiskBudgetBytes({ WORKER_EPHEMERAL_STORAGE_BYTES: 'lots' })).toBeUndefined();
    });
});

describe('estimateRenditionBytes', () => {
    it('is the transcode estimate without the source', () => {
        expect(estimateRenditionBytes(1e9, 3600, { width: 1920, height: 1080 })).toBe(3.6e9);
        expect(estimateRenditionBytes(1e9, undefined)).toBe(2e9);
    });
});

describe('sourceUrlTtlSeconds', () => {
    it('covers the whole Activity, within the 7-day maximum', () => {
        expect(sourceUrlTtlSeconds(60 * 60_000)).toBe(3600);
        expect(sourceUrlTtlSeconds(1500)).toBe(2);
        expect(sourceUrlTtlSeconds(30 * 24 * 3600_000)).toBe(7 * 24 * 3600);
    });
});

describe('estimateTranscodeDiskBytes', () => {
    it('adds the rendition, sized from the duration, to the source', () => {
        // One hour of 1080p at 8 Mbit/s is 3.6 GB.
        expect(estimateTranscodeDiskBytes(1e9, 3600, { width: 1920, height: 1080 })).toBe(1e9 + 3.6e9);
    });

    it('scales the rendition by the output pixels', () => {
        // 480p has a ninth of 1080p's pixels.
        expect(estimateTranscodeDiskBytes(1e9, 3600, { width: 640, height: 360 })).toBeCloseTo(1e9 + 0.4e9, -3);
    });

    it('sizes the rendition as twice the source when the duration or dimensions are unknown', () => {
        expect(estimateTranscodeDiskBytes(1e9, undefined, { width: 1920, height: 1080 })).toBe(3e9);
        expect(estimateTranscodeDiskBytes(1e9, 3600)).toBe(3e9);
        // A video whose probe found no duration, such as browser-recorded WebM, is stored with duration 0.
        expect(estimateTranscodeDiskBytes(1e9, 0, { width: 1920, height: 1080 })).toBe(3e9);
    });
});

describe('transcode time estimate', () => {
    it('scales the encode time from 1080p by the output pixels', () => {
        expect(estimateTranscodeMs(600, 1920, 1080, 2)).toBe(300_000);
        expect(estimateTranscodeMs(600, 1280, 720, 2)).toBeCloseTo(133_333, 0);
    });

    it('reads the realtime factor from the worker env', () => {
        expect(transcodeRealtimeFactor({ WORKER_TRANSCODE_REALTIME_FACTOR: '4' })).toBe(4);
        expect(transcodeRealtimeFactor({})).toBe(2);
        expect(transcodeRealtimeFactor({ WORKER_TRANSCODE_REALTIME_FACTOR: '0' })).toBe(2);
    });
});

const GiB_ = 1024 ** 3;
const SIGNED_URL = 'https://storage.example.com/b/source.mov?X-Signature=secret';
const DOWNLOAD = '/tmp/transcode-test-source.mov';
const RENDITION = { file: '/tmp/out/rendition_1920p.mp4', width: 1920, height: 1080 };
const UPLOADED = { name: 'web', content: { source: 'gs://b/rendition.mp4', type: 'video/mp4' } };

const probed = (duration: number) => ({
    duration,
    width: 1920,
    height: 1080,
    codec: 'h264',
    bitrate: 1,
    fps: 30,
    hasAudio: true,
    formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
    audioStreams: 1,
});

/**
 * A transcode through the real {@link video.withVideoSource} and VideoSource: the client signs `SIGNED_URL` (or fails
 * to), the download is faked, and the encode is `encode`.
 */
interface Run {
    size?: number;
    metadata?: Record<string, unknown>;
    signs?: boolean;
    heartbeatDetails?: unknown;
    startToCloseTimeoutMs?: number;
}

let heartbeats: unknown[];
let getDownloadUrl: ReturnType<typeof vi.fn>;

function run({
    size = 500e6,
    metadata = { duration: 600, dimensions: { width: 1920, height: 1080 } },
    signs = true,
    heartbeatDetails,
    startToCloseTimeoutMs = 60 * 60_000,
}: Run = {}) {
    vi.mocked(video.retrieveVideoObject).mockResolvedValue({
        id: 'object-1',
        content: { source: 'gs://b/source.mov', type: 'video/quicktime', etag: 'etag-1' },
        metadata,
    } as Awaited<ReturnType<typeof video.retrieveVideoObject>>);
    getDownloadUrl = vi.fn(() => (signs ? Promise.resolve({ url: SIGNED_URL }) : Promise.reject(new Error('503'))));
    const client = { files: { getMetadata: vi.fn().mockResolvedValue({ size }), getDownloadUrl } };
    vi.mocked(setupActivity).mockResolvedValue({
        client: client as unknown as VertesiaClient,
        objectId: 'object-1',
        params: {},
    } as unknown as Awaited<ReturnType<typeof setupActivity>>);
    const env = new MockActivityEnvironment({ startToCloseTimeoutMs, attempt: 2, heartbeatDetails });
    env.on('heartbeat', (details: unknown) => heartbeats.push(details));
    return env.run(transcodeVideo, {} as Parameters<typeof transcodeVideo>[0]);
}

const encodeInputs = () =>
    vi.mocked(video.generateRenditionWithDimensions).mock.calls.map(([input]) => (input as VideoInput).kind);
const encodeBudgets = () => vi.mocked(video.generateRenditionWithDimensions).mock.calls.map((call) => call[5]);
const expired = () => Object.assign(new Error(`HTTP error 403 Forbidden reading <signed source URL>`), { code: 1 });

beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    heartbeats = [];
    vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', String(6 * GiB_));
    vi.mocked(saveBlobToTempFile).mockResolvedValue(DOWNLOAD);
    vi.mocked(video.probeVideoSource).mockResolvedValue(probed(600));
    vi.mocked(video.generateRenditionWithDimensions).mockResolvedValue(RENDITION);
    vi.mocked(video.uploadWebRendition).mockResolvedValue(UPLOADED as never);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('transcodeVideo over the signed URL', () => {
    it('encodes from the URL, signed for the whole Activity, without downloading', async () => {
        await expect(run()).resolves.toEqual({ objectId: 'object-1', rendition: UPLOADED, etag: 'etag-1' });

        expect(getDownloadUrl).toHaveBeenCalledWith('gs://b/source.mov', undefined, undefined, 3600);
        expect(vi.mocked(video.generateRenditionWithDimensions).mock.calls[0][0]).toEqual({
            kind: 'url',
            url: SIGNED_URL,
        });
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });

    it('counts only the rendition, so a source that would not fit beside it is still transcoded', async () => {
        // 5 GiB of disk: a 5.5 GB source does not fit, its 0.6 GB rendition does.
        await expect(run({ size: 5.5e9 })).resolves.toMatchObject({ rendition: UPLOADED });
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });

    it('fails without retrying, before reading the source, when the rendition alone would not fit', async () => {
        // Without a duration the rendition is sized as twice the source: 6 GB.
        await expect(run({ size: 3e9, metadata: {} })).rejects.toMatchObject({
            type: TRANSCODE_EXCEEDS_DISK_BUDGET,
            nonRetryable: true,
        });
        expect(getDownloadUrl).not.toHaveBeenCalled();
        expect(video.generateRenditionWithDimensions).not.toHaveBeenCalled();
    });

    it('does not check the disk when the worker does not state its storage', async () => {
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', '');
        await expect(run({ size: 8e9, metadata: {} })).resolves.toMatchObject({ rendition: UPLOADED });
    });

    it('keeps the media size limit, though nothing is downloaded', async () => {
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', String(100 * GiB_));
        await expect(run({ size: 9 * GiB_ })).rejects.toMatchObject({
            type: SOURCE_TOO_LARGE_ERROR,
            nonRetryable: true,
        });
        expect(getDownloadUrl).not.toHaveBeenCalled();
    });
});

describe('transcodeVideo fallback to the download', () => {
    it('downloads and encodes again when the URL encode fails, and tells later attempts to download', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValueOnce(expired());

        await expect(run()).resolves.toMatchObject({ rendition: UPLOADED });

        expect(encodeInputs()).toEqual(['url', 'file']);
        expect(vi.mocked(video.generateRenditionWithDimensions).mock.calls[1][0]).toEqual({
            kind: 'file',
            path: DOWNLOAD,
        });
        expect(heartbeats).toContainEqual({ downloadSource: true, deadlinePreset: undefined });
    });

    it('gives the fallback encode only the time the URL encode left', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.mocked(video.generateRenditionWithDimensions).mockImplementationOnce(() => {
            vi.setSystemTime(Date.now() + 30 * 60_000);
            return Promise.reject(expired());
        });

        await expect(run()).resolves.toMatchObject({ rendition: UPLOADED });

        const [urlBudget, fileBudget] = encodeBudgets() as number[];
        expect(urlBudget).toBeGreaterThan(54 * 60_000);
        expect(fileBudget).toBeLessThanOrEqual(25 * 60_000);
        expect(fileBudget).toBeGreaterThan(24 * 60_000);
    });

    it('retries, without downloading, when the URL encode failed with no time left', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.mocked(video.generateRenditionWithDimensions).mockImplementationOnce(() => {
            vi.setSystemTime(Date.now() + 57 * 60_000);
            return Promise.reject(expired());
        });

        await expect(run()).rejects.toMatchObject({ type: TRANSCODE_SOURCE_URL_FAILED, nonRetryable: false });
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
        expect(heartbeats.at(-1)).toEqual({ downloadSource: true, deadlinePreset: undefined });
    });

    it('retries from the download when the fallback encode runs out of time', async () => {
        vi.mocked(video.generateRenditionWithDimensions)
            .mockRejectedValueOnce(expired())
            .mockRejectedValueOnce(
                ApplicationFailure.create({ type: TRANSCODE_EXCEEDS_TIME_BUDGET, nonRetryable: true }),
            );

        await expect(run()).rejects.toMatchObject({ type: TRANSCODE_SOURCE_URL_FAILED, nonRetryable: false });
        expect(heartbeats.at(-1)).toEqual({ downloadSource: true, deadlinePreset: undefined });
    });

    it('retries the URL failure, without downloading, when the source would not fit beside the rendition', async () => {
        const failure = expired();
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValueOnce(failure);

        await expect(run({ size: 5.5e9 })).rejects.toThrow(/Failed to transcode video object-1: HTTP error 403/);
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
        expect(encodeInputs()).toEqual(['url']);
    });

    it('keeps the signed URL out of the failure', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValueOnce(expired());

        const error = await run({ size: 5.5e9 }).catch((e: unknown) => e);
        expect(String((error as Error).message)).not.toContain('X-Signature');
    });

    it('fails without retrying when no URL can be signed and the download would not fit', async () => {
        await expect(run({ size: 5.5e9, signs: false })).rejects.toMatchObject({
            type: TRANSCODE_EXCEEDS_DISK_BUDGET,
            nonRetryable: true,
        });
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });

    it('downloads up front when no URL can be signed and the download fits', async () => {
        await expect(run({ signs: false })).resolves.toMatchObject({ rendition: UPLOADED });
        expect(encodeInputs()).toEqual(['file']);
    });

    it('does not fall back when the URL encode ran into the deadline', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValueOnce(
            Object.assign(new Error('ffmpeg was still running at the deadline'), {
                killed: true,
                deadlineExceeded: true,
            }),
        );

        await expect(run()).rejects.toMatchObject({ type: 'TranscodeDeadlineExceeded', nonRetryable: false });
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
        expect(heartbeats.at(-1)).toEqual({ deadlinePreset: 'veryfast', downloadSource: undefined });
    });
});

describe('transcodeVideo after an attempt whose URL read failed', () => {
    it('downloads before encoding', async () => {
        await expect(run({ heartbeatDetails: { downloadSource: true } })).resolves.toMatchObject({
            rendition: UPLOADED,
        });
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        expect(encodeInputs()).toEqual(['file']);
    });

    it('counts the source in the disk check', async () => {
        await expect(run({ size: 5.5e9, heartbeatDetails: { downloadSource: true } })).rejects.toMatchObject({
            type: TRANSCODE_EXCEEDS_DISK_BUDGET,
            nonRetryable: true,
        });
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });

    it('keeps downloading on a retry after a deadline', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValueOnce(
            Object.assign(new Error('deadline'), { killed: true, deadlineExceeded: true }),
        );

        await expect(run({ heartbeatDetails: { downloadSource: true } })).rejects.toMatchObject({
            type: 'TranscodeDeadlineExceeded',
        });
        expect(heartbeats.at(-1)).toEqual({ deadlinePreset: 'veryfast', downloadSource: true });
    });
});

describe('transcodeVideo time check', () => {
    it('fails without retrying, before reading the source, when the encode cannot fit in the hour', async () => {
        // 3h of 1080p at the default 2x realtime is about 90 min, over the 55 min left after the margin.
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', String(100 * GiB_));
        await expect(
            run({ size: 100e6, metadata: { duration: 3 * 3600, dimensions: { width: 1920, height: 1080 } } }),
        ).rejects.toMatchObject({ type: TRANSCODE_EXCEEDS_TIME_BUDGET, nonRetryable: true });
        expect(getDownloadUrl).not.toHaveBeenCalled();
    });

    it('transcodes a video that fits, judging the 4K source by its 1080p output', async () => {
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', String(100 * GiB_));
        await expect(
            run({ size: 100e6, metadata: { duration: 90 * 60, dimensions: { width: 3840, height: 2160 } } }),
        ).resolves.toMatchObject({ rendition: UPLOADED });
    });

    it('treats a zero duration as unknown and transcodes without the pre-check', async () => {
        // Browser-recorded WebM is stored with duration 0; that is no duration, not an instant encode.
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', String(100 * GiB_));
        await expect(
            run({ size: 100e6, metadata: { duration: 0, dimensions: { width: 3840, height: 2160 } } }),
        ).resolves.toMatchObject({ rendition: UPLOADED });
    });

    it('passes the budget to the encode and keeps an overrun non-retryable', async () => {
        const overrun = ApplicationFailure.create({ type: TRANSCODE_EXCEEDS_TIME_BUDGET, nonRetryable: true });
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValue(overrun);

        await expect(run()).rejects.toBe(overrun);
        const [budgetMs] = encodeBudgets() as number[];
        expect(budgetMs).toBeGreaterThan(50 * 60_000);
        expect(budgetMs).toBeLessThanOrEqual(55 * 60_000);
        expect(saveBlobToTempFile).not.toHaveBeenCalled();
    });

    it('keeps a budget for a short video under a five-minute Start-to-Close timeout', async () => {
        await expect(
            run({
                size: 10e6,
                metadata: { duration: 30, dimensions: { width: 1280, height: 720 } },
                startToCloseTimeoutMs: 5 * 60_000,
            }),
        ).resolves.toMatchObject({ rendition: UPLOADED });
        expect(getDownloadUrl).toHaveBeenCalledWith('gs://b/source.mov', undefined, undefined, 300);
    });
});

describe('transcodeVideo for content that changed', () => {
    it('transcodes nothing when the content changed since the given etag', async () => {
        vi.mocked(video.retrieveVideoObject).mockResolvedValue({
            id: 'object-1',
            content: { source: 'gs://b/new.mp4', type: 'video/mp4', etag: 'etag-2' },
            metadata: { duration: 30, dimensions: { width: 1280, height: 720 } },
        } as Awaited<ReturnType<typeof video.retrieveVideoObject>>);
        const getMetadata = vi.fn();
        vi.mocked(setupActivity).mockResolvedValue({
            client: { files: { getMetadata } } as unknown as VertesiaClient,
            objectId: 'object-1',
            params: { etag: 'etag-1' },
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);

        await expect(
            new MockActivityEnvironment({ startToCloseTimeoutMs: 60 * 60_000 }).run(
                transcodeVideo,
                {} as Parameters<typeof transcodeVideo>[0],
            ),
        ).resolves.toEqual({ objectId: 'object-1', rendition: null, etag: 'etag-1' });
        expect(video.generateRenditionWithDimensions).not.toHaveBeenCalled();
        expect(getMetadata).not.toHaveBeenCalled();
    });
});

describe('transcodeVideo deadline', () => {
    // Live-recorded WebM: no duration, so neither budget check can run.
    const live = { size: 100e6, metadata: {} };
    const deadlineKill = () =>
        Object.assign(new Error('ffmpeg was still running at the deadline'), { killed: true, deadlineExceeded: true });

    beforeEach(() => {
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', String(100 * GiB_));
        vi.mocked(video.probeVideoSource).mockResolvedValue({ ...probed(0), width: 1280, height: 720 });
    });

    it('retries at a faster preset when the encode runs into the deadline at veryfast', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValue(deadlineKill());

        await expect(run(live)).rejects.toMatchObject({ type: 'TranscodeDeadlineExceeded', nonRetryable: false });
        expect(vi.mocked(video.generateRenditionWithDimensions).mock.calls[0][4]).toBe('veryfast');
        expect(heartbeats).toContainEqual({ deadlinePreset: 'veryfast', downloadSource: undefined });
    });

    it('uses ultrafast after a deadline at veryfast, and fails without retrying when that also runs into it', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValue(deadlineKill());

        await expect(run({ ...live, heartbeatDetails: { deadlinePreset: 'veryfast' } })).rejects.toMatchObject({
            type: TRANSCODE_EXCEEDS_TIME_BUDGET,
            nonRetryable: true,
        });
        expect(vi.mocked(video.generateRenditionWithDimensions).mock.calls[0][4]).toBe('ultrafast');
    });

    it('keeps the preset on a retry after any other failure', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockResolvedValue(null);

        await expect(run(live)).resolves.toMatchObject({ rendition: null });
        expect(vi.mocked(video.generateRenditionWithDimensions).mock.calls[0][4]).toBe('veryfast');
    });

    it('keeps a stall on the download retryable, as before', async () => {
        const stall = Object.assign(new Error('ffmpeg made no progress'), { killed: true, stalled: true });
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValue(stall);

        await expect(run({ ...live, signs: false })).rejects.toBe(stall);
    });

    it('runs a URL encode that stalled again on the download', async () => {
        const stall = Object.assign(new Error('ffmpeg made no progress'), { killed: true, stalled: true });
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValueOnce(stall);

        await expect(run(live)).resolves.toMatchObject({ rendition: UPLOADED });
        expect(encodeInputs()).toEqual(['url', 'file']);
    });
});
