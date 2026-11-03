import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import {
    estimateTranscodeDiskBytes,
    TRANSCODE_EXCEEDS_DISK_BUDGET,
    transcodeDiskBudgetBytes,
    transcodeVideo,
} from './transcodeVideo.js';
import * as video from './video.js';

vi.mock('../../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));
vi.mock('./video.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./video.js')>();
    return { ...actual, retrieveVideoObject: vi.fn(), withVideoWorkspace: vi.fn().mockResolvedValue('transcoded') };
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
        return new MockActivityEnvironment().run(transcodeVideo, {} as Parameters<typeof transcodeVideo>[0]);
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
