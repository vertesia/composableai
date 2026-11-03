import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, type DSLActivityExecutionPayload } from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../../dsl/setup/ActivityContext.js';
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

let testEnv: MockActivityEnvironment;

beforeAll(async () => {
    testEnv = new MockActivityEnvironment();
});

beforeEach(() => {
    vi.clearAllMocks();
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

        await expect(testEnv.run(probeMediaStreams, createPayload())).rejects.toThrow(
            'No audio or video streams found in container',
        );
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

    it('keeps the signed URL out of the error when ffprobe fails', async () => {
        await setupMockContext('test-object-id', SIGNED_URL);
        vi.mocked(execActivityFile).mockRejectedValue(
            Object.assign(new Error(`Command failed: ffprobe ${SIGNED_URL}\n${SIGNED_URL}: Server returned 403`), {
                cmd: `ffprobe ${SIGNED_URL}`,
            }),
        );

        const failure = (await testEnv
            .run(probeMediaStreams, createPayload())
            .catch((error: unknown) => error)) as Error;

        expect(failure).toBeInstanceOf(Error);
        expect(failure.message).toContain('Failed to probe media streams');
        expect(failure.message).not.toContain('secret');
    });
});
