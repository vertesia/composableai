import { ApplicationFailure, log } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, type DSLActivityExecutionPayload } from '@vertesia/common';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../../errors.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import { execActivityFile } from './exec.js';
import {
    buildStreamProbeArgs,
    type ProbeMediaStreamsParams,
    type ProbeMediaStreamsResult,
    probeMediaStreams,
} from './probeMediaStreams.js';
import { HTTP_INPUT_OPTIONS } from './videoSource.js';

vi.mock('../../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

// probeMediaStreams delegates ffprobe to the shared exec helper, so mock that seam and drive the parsed output
// directly. The helper's cancellation/timeout wrapping is covered by exec.test.ts.
vi.mock('./exec.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./exec.js')>();
    return { ...actual, execActivityFile: vi.fn() };
});

vi.mock('../../utils/blobs.js', () => ({ saveBlobToTempFile: vi.fn() }));

const DOWNLOADED = '/tmp/probe-media-streams-test.mp4';

let testEnv: MockActivityEnvironment;

beforeAll(async () => {
    testEnv = new MockActivityEnvironment();
});

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveBlobToTempFile).mockResolvedValue(DOWNLOADED);
});

const createPayload = (objectId = 'test-object-id'): DSLActivityExecutionPayload<ProbeMediaStreamsParams> => ({
    auth_token: 'mock-token',
    account_id: 'test-account',
    project_id: 'test-project',
    params: {} satisfies ProbeMediaStreamsParams,
    config: { studio_url: 'http://mock-studio', store_url: 'http://mock-store' },
    workflow_name: 'test-workflow',
    event: ContentEventName.create,
    objectIds: [objectId],
    input: { inputType: 'objectIds', objectIds: [objectId] },
    vars: {},
    activity: { name: 'probeMediaStreams', params: {} satisfies ProbeMediaStreamsParams },
});

function mockExec(stdout: string) {
    vi.mocked(execActivityFile).mockResolvedValue({ stdout, stderr: '' });
}

async function setupMockContext(objectId: string, signedUrl: string): Promise<void> {
    const { setupActivity } = await import('../../dsl/setup/ActivityContext.js');
    const mockClient = {
        objects: {
            retrieve: vi.fn().mockResolvedValue({
                content: { source: 'gs://bucket/file.mp4', type: 'video/mp4' },
            }),
        },
        files: {
            getDownloadUrl: vi.fn().mockResolvedValue({ url: signedUrl }),
        },
    } as unknown as VertesiaClient;
    vi.mocked(setupActivity).mockResolvedValue({
        client: mockClient,
        objectId,
        inputType: 'objectIds',
        params: {} satisfies ProbeMediaStreamsParams,
    } as unknown as ActivityContext<ProbeMediaStreamsParams>);
}

describe('probeMediaStreams', () => {
    it('should return hasVideo=true and hasAudio=true for a video+audio container', async () => {
        await setupMockContext('test-object-id', 'https://storage.example.com/file.mp4?token=abc');
        mockExec(JSON.stringify({ streams: [{ codec_type: 'video' }, { codec_type: 'audio' }] }));

        const result: ProbeMediaStreamsResult = await testEnv.run(probeMediaStreams, createPayload());

        expect(result).toEqual({ hasVideo: true, hasAudio: true });
    });

    it('should return hasVideo=true and hasAudio=false for a video-only container', async () => {
        await setupMockContext('test-object-id', 'https://storage.example.com/file.mp4');
        mockExec(JSON.stringify({ streams: [{ codec_type: 'video' }] }));

        const result: ProbeMediaStreamsResult = await testEnv.run(probeMediaStreams, createPayload());

        expect(result).toEqual({ hasVideo: true, hasAudio: false });
    });

    it('should return hasVideo=false and hasAudio=true for an audio-only container (the bug case)', async () => {
        await setupMockContext('test-object-id', 'https://storage.example.com/audio-only.mp4');
        mockExec(JSON.stringify({ streams: [{ codec_type: 'audio' }] }));

        const result: ProbeMediaStreamsResult = await testEnv.run(probeMediaStreams, createPayload());

        expect(result).toEqual({ hasVideo: false, hasAudio: true });
    });

    it('should throw nonRetryable ApplicationFailure when no usable streams are found', async () => {
        await setupMockContext('test-object-id', 'https://storage.example.com/bad.mp4');
        mockExec(JSON.stringify({ streams: [] }));

        const failure = await testEnv.run(probeMediaStreams, createPayload()).catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(ApplicationFailure);
        expect(failure).toMatchObject({ nonRetryable: true });
        expect((failure as Error).message).toContain('No audio or video streams found in container');
        // Confirmed on the download, not decided by the 32k read over HTTP.
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
    });

    it('should throw DocumentNotFoundError when the object has no source', async () => {
        const { setupActivity } = await import('../../dsl/setup/ActivityContext.js');
        const mockClient = {
            objects: {
                retrieve: vi.fn().mockResolvedValue({ content: {} }),
            },
            files: { getDownloadUrl: vi.fn() },
        } as unknown as VertesiaClient;
        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: 'test-object-id',
            inputType: 'objectIds',
            params: {} satisfies ProbeMediaStreamsParams,
        } as unknown as ActivityContext<ProbeMediaStreamsParams>);

        await expect(testEnv.run(probeMediaStreams, createPayload())).rejects.toThrow('has no source');
    });
});

describe('probeMediaStreams over a signed URL', () => {
    const SIGNED_URL = 'https://storage.example.com/bucket/file.mp4?X-Signature=secret';

    it('caps the probe size and puts the reconnect options before the URL', () => {
        const args = buildStreamProbeArgs({ kind: 'url', url: SIGNED_URL });

        expect(args).toEqual(expect.arrayContaining(['-probesize', '32k', '-show_streams']));
        expect(args.at(-1)).toBe(SIGNED_URL);
        expect(args.slice(-1 - HTTP_INPUT_OPTIONS.length, -1)).toEqual([...HTTP_INPUT_OPTIONS]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Fake ffprobe: `url` and `local` give the outcome of a probe of the URL and of the download. */
    function mockProbe(url: string | Error, local: string | Error) {
        vi.mocked(execActivityFile).mockImplementation((_command, args) => {
            const outcome = args.at(-1) === DOWNLOADED ? local : url;
            return outcome instanceof Error
                ? Promise.reject(
                      Object.assign(new Error(`Command failed: ffprobe ${args.join(' ')}\n${outcome.message}`), {
                          cmd: `ffprobe ${args.join(' ')}`,
                      }),
                  )
                : Promise.resolve({ stdout: outcome, stderr: '' });
        });
    }

    it('probes the download when ffprobe fails over the URL', async () => {
        await setupMockContext('test-object-id', SIGNED_URL);
        mockProbe(new Error('Server returned 403 Forbidden'), JSON.stringify({ streams: [{ codec_type: 'video' }] }));

        const result = await testEnv.run(probeMediaStreams, createPayload());

        expect(result).toEqual({ hasVideo: true, hasAudio: false });
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
        expect(vi.mocked(execActivityFile).mock.calls.map(([, args]) => args.at(-1))).toEqual([SIGNED_URL, DOWNLOADED]);
    });

    it('confirms a URL probe that finds no stream on the download', async () => {
        await setupMockContext('test-object-id', SIGNED_URL);
        mockProbe(JSON.stringify({ streams: [] }), JSON.stringify({ streams: [{ codec_type: 'audio' }] }));

        const result = await testEnv.run(probeMediaStreams, createPayload());

        expect(result).toEqual({ hasVideo: false, hasAudio: true });
        expect(saveBlobToTempFile).toHaveBeenCalledTimes(1);
    });

    it('keeps the signed URL out of logs and the error when both probes fail', async () => {
        await setupMockContext('test-object-id', SIGNED_URL);
        mockProbe(new Error(`${SIGNED_URL}: Server returned 403`), new Error('Invalid data found'));
        const warn = vi.spyOn(log, 'warn');
        const error = vi.spyOn(log, 'error');

        const failure = (await testEnv
            .run(probeMediaStreams, createPayload())
            .catch((caught: unknown) => caught)) as Error;

        expect(failure).toBeInstanceOf(Error);
        expect(failure.message).toContain('Failed to probe media streams');
        expect(failure.message).not.toContain('secret');
        expect(JSON.stringify([warn.mock.calls, error.mock.calls])).not.toContain('secret');
        expect(warn).toHaveBeenCalledWith(
            'Reading the video over its signed URL failed; downloading it instead',
            expect.anything(),
        );
    });

    it('keeps the type of a failed download', async () => {
        await setupMockContext('test-object-id', SIGNED_URL);
        mockProbe(new Error('Server returned 404'), JSON.stringify({ streams: [] }));
        const notFound = new DocumentNotFoundError('Not found at gs://bucket/file.mp4', []);
        vi.mocked(saveBlobToTempFile).mockRejectedValue(notFound);

        await expect(testEnv.run(probeMediaStreams, createPayload())).rejects.toBe(notFound);
    });
});
