import { MockActivityEnvironment } from '@temporalio/testing';
import { RequestError } from '@vertesia/api-fetch-client';
import type { VertesiaClient } from '@vertesia/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { type ExtractVideoAssetsParams, extractVideoAssets } from './extractVideoAssets.js';
import * as video from './video.js';

vi.mock('../../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));
vi.mock('./video.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./video.js')>();
    return {
        ...actual,
        retrieveVideoObject: vi.fn(),
        withVideoWorkspace: vi.fn((_client, _source, _prefix, work) => work('/tmp/in.mp4', '/tmp/out')),
        getVideoMetadata: vi.fn(),
        extractVideoFrames: vi.fn(),
        generateAudioRendition: vi.fn(),
        uploadVideoAssets: vi.fn(),
    };
});

const poster = {
    name: 'Poster',
    dimensions: { width: 1920, height: 1080 },
    content: { source: 'gs://b/renditions/etag-1/1920/poster.jpg', type: 'image/jpeg', name: 'poster.jpg' },
};

let objects: { retrieve: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

function run(params: ExtractVideoAssetsParams) {
    vi.mocked(setupActivity).mockResolvedValue({
        client: { objects } as unknown as VertesiaClient,
        objectId: 'object-1',
        params,
    } as unknown as Awaited<ReturnType<typeof setupActivity>>);
    return new MockActivityEnvironment().run(extractVideoAssets, {} as Parameters<typeof extractVideoAssets>[0]);
}

beforeEach(() => {
    vi.clearAllMocks();
    objects = {
        retrieve: vi.fn().mockResolvedValue({ metadata: { generation_runs: [] }, content: { etag: 'etag-1' } }),
        update: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(video.retrieveVideoObject).mockResolvedValue({
        id: 'object-1',
        content: { source: 'gs://b/source.mov', type: 'video/quicktime', etag: 'etag-1' },
    } as Awaited<ReturnType<typeof video.retrieveVideoObject>>);
    vi.mocked(video.getVideoMetadata).mockResolvedValue({
        duration: 60,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 1,
        fps: 30,
        hasAudio: true,
    });
    vi.mocked(video.extractVideoFrames).mockResolvedValue({ thumbnail: null, poster: null });
    vi.mocked(video.generateAudioRendition).mockResolvedValue(null);
    vi.mocked(video.uploadVideoAssets).mockResolvedValue([poster]);
});

describe('extractVideoAssets', () => {
    it('marks the web rendition as pending for the current content', async () => {
        const result = await run({});

        const written = objects.update.mock.calls[0][1].metadata;
        expect(written.renditions).toEqual([poster]);
        expect(written.pending_renditions).toEqual({ etag: 'etag-1', names: ['Web'] });
        expect(result).toMatchObject({ etag: 'etag-1', status: 'success' });
    });

    it('guards the write with the content etag the assets were made from', async () => {
        await run({});

        expect(objects.update.mock.calls[0][2]).toEqual({ ifMatch: 'etag-1' });
    });

    it('stores nothing when the content changed during the extraction', async () => {
        objects.retrieve.mockResolvedValue({ metadata: {}, content: { etag: 'etag-2' } });

        await expect(run({})).resolves.toMatchObject({ status: 'success' });
        expect(objects.update).not.toHaveBeenCalled();
    });

    it('stores nothing when the content changes between the read and the write', async () => {
        objects.update.mockRejectedValue(
            new RequestError('Precondition Failed', new Request('http://test-store/objects/object-1'), 412, {}),
        );

        await expect(run({})).resolves.toMatchObject({ status: 'success' });
    });

    it('marks nothing pending when the transcode is skipped', async () => {
        await run({ skipTranscode: true });

        expect(objects.update.mock.calls[0][1].metadata.pending_renditions).toBeUndefined();
    });
});
