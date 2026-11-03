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

    it('assumes 10 GiB when it is not configured or not a number', () => {
        expect(transcodeDiskBudgetBytes({})).toBe(9 * GiB);
        expect(transcodeDiskBudgetBytes({ WORKER_EPHEMERAL_STORAGE_BYTES: 'lots' })).toBe(9 * GiB);
    });
});

describe('estimateTranscodeDiskBytes', () => {
    it('adds the rendition, sized from the duration, to the source', () => {
        // One hour at 12 Mbit/s is 5.4 GB.
        expect(estimateTranscodeDiskBytes(1e9, 3600)).toBe(1e9 + 5.4e9);
    });

    it('sizes the rendition as twice the source when the duration is unknown', () => {
        expect(estimateTranscodeDiskBytes(1e9, undefined)).toBe(3e9);
    });
});

describe('transcodeVideo disk check', () => {
    let files: { getMetadata: ReturnType<typeof vi.fn> };

    function run(metadata: Record<string, unknown> = { duration: 600 }) {
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
        // Plenty of disk, so only the time check can reject it.
        vi.stubEnv('WORKER_EPHEMERAL_STORAGE_BYTES', String(100 * GiB));
        // 3h of 1080p at the default 2x realtime is about 90 min, over the 55 min left after the margin.
        await expect(run({ duration: 3 * 3600, dimensions: { width: 1920, height: 1080 } })).rejects.toMatchObject({
            type: TRANSCODE_EXCEEDS_TIME_BUDGET,
            nonRetryable: true,
        });
        expect(video.withVideoWorkspace).not.toHaveBeenCalled();
        vi.unstubAllEnvs();
    });

    it('transcodes a video that fits, judging the 4K source by its 1080p output', async () => {
        await expect(run({ duration: 90 * 60, dimensions: { width: 3840, height: 2160 } })).resolves.toBe('transcoded');
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
        });
        const overrun = ApplicationFailure.create({ type: TRANSCODE_EXCEEDS_TIME_BUDGET, nonRetryable: true });
        vi.mocked(video.generateRenditionWithDimensions).mockRejectedValue(overrun);

        await expect(run({ duration: 600, dimensions: { width: 1920, height: 1080 } })).rejects.toBe(overrun);
        const budgetMs = vi.mocked(video.generateRenditionWithDimensions).mock.calls[0][5];
        expect(budgetMs).toBeGreaterThan(50 * 60_000);
        expect(budgetMs).toBeLessThanOrEqual(55 * 60_000);
    });
});
