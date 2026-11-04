import { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { TRANSCODE_EXCEEDS_TIME_BUDGET } from './exec.js';
import {
    estimateTranscodeDiskBytes,
    estimateTranscodeMs,
    TRANSCODE_EXCEEDS_DISK_BUDGET,
    transcodeDiskBudgetBytes,
    transcodeRealtimeFactor,
    transcodeVideo,
} from './transcodeVideo.js';
import * as video from './video.js';

vi.mock('../../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));
vi.mock('./video.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./video.js')>();
    return {
        ...actual,
        retrieveVideoObject: vi.fn(),
        withVideoWorkspace: vi.fn().mockResolvedValue('transcoded'),
        getVideoMetadata: vi.fn(),
        generateRenditionWithDimensions: vi.fn(),
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

describe('transcodeVideo disk check', () => {
    let files: { getMetadata: ReturnType<typeof vi.fn> };

    function run(metadata: Record<string, unknown> = { duration: 600, dimensions: { width: 1920, height: 1080 } }) {
        vi.mocked(video.retrieveVideoObject).mockResolvedValue({
            id: 'object-1',
            content: { source: 'gs://b/source.mov', type: 'video/quicktime', etag: 'etag-1' },
            metadata,
        } as Awaited<ReturnType<typeof video.retrieveVideoObject>>);
        vi.mocked(setupActivity).mockResolvedValue({
            client: { files } as unknown as VertesiaClient,
            objectId: 'object-1',
            params: {},
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
        return new MockActivityEnvironment({ startToCloseTimeoutMs: 60 * 60_000 }).run(
            transcodeVideo,
            {} as Parameters<typeof transcodeVideo>[0],
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', String(10 * GiB));
        files = { getMetadata: vi.fn() };
    });

    it('fails without retrying, before downloading, when the source would not fit', async () => {
        files.getMetadata.mockResolvedValue({ size: 9.5e9 });

        await expect(run()).rejects.toMatchObject({ type: TRANSCODE_EXCEEDS_DISK_BUDGET, nonRetryable: true });
        expect(video.withVideoWorkspace).not.toHaveBeenCalled();
    });

    it('transcodes a source that fits', async () => {
        files.getMetadata.mockResolvedValue({ size: 500e6 });

        await expect(run()).resolves.toBe('transcoded');
        expect(video.withVideoWorkspace).toHaveBeenCalled();
    });

    it('falls back to the size in the object metadata', async () => {
        files.getMetadata.mockRejectedValue(new Error('no such file'));

        await expect(run({ duration: 600, size: 9e9 })).rejects.toMatchObject({ type: TRANSCODE_EXCEEDS_DISK_BUDGET });
    });

    it('transcodes without a check when the size is unknown', async () => {
        files.getMetadata.mockRejectedValue(new Error('no such file'));

        await expect(run({ duration: 600 })).resolves.toBe('transcoded');
    });

    it('transcodes a long phone video whose 1080p rendition fits beside it', async () => {
        // 45 min at 20 Mbit/s is 6.75 GB; its 1080p rendition is estimated at 2.7 GB.
        files.getMetadata.mockResolvedValue({ size: 6.75e9 });

        await expect(run({ duration: 45 * 60, dimensions: { width: 1920, height: 1080 } })).resolves.toBe('transcoded');
    });

    it('does not check the disk when the worker does not state its storage', async () => {
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', '');
        files.getMetadata.mockResolvedValue({ size: 50e9 });

        await expect(run()).resolves.toBe('transcoded');
        expect(files.getMetadata).not.toHaveBeenCalled();
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

describe('transcodeVideo time check', () => {
    function run(metadata: Record<string, unknown>) {
        vi.mocked(video.retrieveVideoObject).mockResolvedValue({
            id: 'object-1',
            content: { source: 'gs://b/source.mov', type: 'video/quicktime', etag: 'etag-1' },
            metadata,
        } as Awaited<ReturnType<typeof video.retrieveVideoObject>>);
        vi.mocked(setupActivity).mockResolvedValue({
            client: { files: { getMetadata: vi.fn().mockResolvedValue({ size: 100e6 }) } } as unknown as VertesiaClient,
            objectId: 'object-1',
            params: {},
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
        return new MockActivityEnvironment({ startToCloseTimeoutMs: 60 * 60_000 }).run(
            transcodeVideo,
            {} as Parameters<typeof transcodeVideo>[0],
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(video.withVideoWorkspace).mockResolvedValue('transcoded' as never);
    });

    it('fails without retrying, before downloading, when the encode cannot fit in the hour', async () => {
        // 3h of 1080p at the default 2x realtime is about 90 min, over the 55 min left after the margin.
        await expect(run({ duration: 3 * 3600, dimensions: { width: 1920, height: 1080 } })).rejects.toMatchObject({
            type: TRANSCODE_EXCEEDS_TIME_BUDGET,
            nonRetryable: true,
        });
        expect(video.withVideoWorkspace).not.toHaveBeenCalled();
    });

    it('transcodes a video that fits, judging the 4K source by its 1080p output', async () => {
        await expect(run({ duration: 90 * 60, dimensions: { width: 3840, height: 2160 } })).resolves.toBe('transcoded');
    });

    it('treats a zero duration as unknown and transcodes without the pre-check', async () => {
        // Browser-recorded WebM is stored with duration 0; that is no duration, not an instant encode.
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', String(100 * GiB));
        await expect(run({ duration: 0, dimensions: { width: 3840, height: 2160 } })).resolves.toBe('transcoded');
        expect(video.withVideoWorkspace).toHaveBeenCalled();
        vi.unstubAllEnvs();
    });

    it('passes the budget to the encode and keeps an overrun non-retryable', async () => {
        vi.mocked(video.withVideoWorkspace).mockImplementation(((_client, _source, _prefix, work) =>
            work('/tmp/in.mov', '/tmp/out')) as typeof video.withVideoWorkspace);
        vi.mocked(video.getVideoMetadata).mockResolvedValue({
            duration: 600,
            width: 1920,
            height: 1080,
            codec: 'h264',
            bitrate: 1,
            fps: 30,
            hasAudio: true,
            formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
            audioStreams: 1,
        });
        const overrun = ApplicationFailure.create({ type: TRANSCODE_EXCEEDS_TIME_BUDGET, nonRetryable: true });
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValue(overrun);

        await expect(run({ duration: 600, dimensions: { width: 1920, height: 1080 } })).rejects.toBe(overrun);
        const budgetMs = vi.mocked(video.generateRenditionWithDimensions).mock.calls[0][5];
        expect(budgetMs).toBeGreaterThan(50 * 60_000);
        expect(budgetMs).toBeLessThanOrEqual(55 * 60_000);
    });
});

describe('transcodeVideo with a short timeout', () => {
    it('keeps a budget for a short video under a five-minute Start-to-Close timeout', async () => {
        vi.clearAllMocks();
        vi.mocked(video.withVideoWorkspace).mockResolvedValue('transcoded' as never);
        vi.mocked(video.retrieveVideoObject).mockResolvedValue({
            id: 'object-1',
            content: { source: 'gs://b/clip.mp4', type: 'video/mp4', etag: 'etag-1' },
            metadata: { duration: 30, dimensions: { width: 1280, height: 720 } },
        } as Awaited<ReturnType<typeof video.retrieveVideoObject>>);
        vi.mocked(setupActivity).mockResolvedValue({
            client: { files: { getMetadata: vi.fn().mockResolvedValue({ size: 10e6 }) } } as unknown as VertesiaClient,
            objectId: 'object-1',
            params: {},
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);

        await expect(
            new MockActivityEnvironment({ startToCloseTimeoutMs: 5 * 60_000 }).run(
                transcodeVideo,
                {} as Parameters<typeof transcodeVideo>[0],
            ),
        ).resolves.toBe('transcoded');
    });
});

describe('transcodeVideo for content that changed', () => {
    it('transcodes nothing when the content changed since the given etag', async () => {
        vi.clearAllMocks();
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
        expect(video.withVideoWorkspace).not.toHaveBeenCalled();
        expect(getMetadata).not.toHaveBeenCalled();
    });
});

describe('transcodeVideo deadline', () => {
    function run(heartbeatDetails?: unknown) {
        vi.mocked(video.retrieveVideoObject).mockResolvedValue({
            id: 'object-1',
            content: { source: 'gs://b/live.webm', type: 'video/webm', etag: 'etag-1' },
            // Live-recorded WebM: no duration, so neither budget check can run.
            metadata: {},
        } as Awaited<ReturnType<typeof video.retrieveVideoObject>>);
        vi.mocked(setupActivity).mockResolvedValue({
            client: { files: { getMetadata: vi.fn().mockResolvedValue({ size: 100e6 }) } } as unknown as VertesiaClient,
            objectId: 'object-1',
            params: {},
        } as unknown as Awaited<ReturnType<typeof setupActivity>>);
        env = new MockActivityEnvironment({ startToCloseTimeoutMs: 60 * 60_000, attempt: 2, heartbeatDetails });
        env.on('heartbeat', (details: unknown) => heartbeats.push(details));
        return env.run(transcodeVideo, {} as Parameters<typeof transcodeVideo>[0]);
    }

    let env: MockActivityEnvironment;
    let heartbeats: unknown[];

    beforeEach(() => {
        vi.clearAllMocks();
        heartbeats = [];
        vi.mocked(video.withVideoWorkspace).mockImplementation(((_client, _source, _prefix, work) =>
            work('/tmp/in.webm', '/tmp/out')) as typeof video.withVideoWorkspace);
        vi.mocked(video.getVideoMetadata).mockResolvedValue({
            duration: 0,
            width: 1280,
            height: 720,
            codec: 'vp8',
            bitrate: 0,
            fps: 30,
            hasAudio: true,
            formatName: 'matroska,webm',
            audioStreams: 1,
        });
    });

    const deadlineKill = () =>
        Object.assign(new Error('ffmpeg was still running at the deadline'), { killed: true, deadlineExceeded: true });

    it('retries at a faster preset when the encode runs into the deadline at veryfast', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValue(deadlineKill());

        await expect(run()).rejects.toMatchObject({ type: 'TranscodeDeadlineExceeded', nonRetryable: false });
        expect(vi.mocked(video.generateRenditionWithDimensions).mock.calls[0][4]).toBe('veryfast');
        expect(heartbeats).toContainEqual({ deadlinePreset: 'veryfast' });
    });

    it('uses ultrafast after a deadline at veryfast, and fails without retrying when that also runs into it', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValue(deadlineKill());

        await expect(run({ deadlinePreset: 'veryfast' })).rejects.toMatchObject({
            type: TRANSCODE_EXCEEDS_TIME_BUDGET,
            nonRetryable: true,
        });
        expect(vi.mocked(video.generateRenditionWithDimensions).mock.calls[0][4]).toBe('ultrafast');
    });

    it('keeps the preset on a retry after any other failure', async () => {
        vi.mocked(video.generateRenditionWithDimensions).mockResolvedValue(null);

        await expect(run()).resolves.toMatchObject({ rendition: null });
        expect(vi.mocked(video.generateRenditionWithDimensions).mock.calls[0][4]).toBe('veryfast');
    });

    it('keeps a stall retryable, as before', async () => {
        const stall = Object.assign(new Error('ffmpeg made no progress'), { killed: true, stalled: true });
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValue(stall);

        await expect(run(1)).rejects.toBe(stall);
    });
});
