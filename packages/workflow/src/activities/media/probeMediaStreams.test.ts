import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, DSLActivityExecutionPayload } from '@vertesia/common';
import type { ActivityContext } from '@vertesia/workflow';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeMediaStreams, ProbeMediaStreamsParams, ProbeMediaStreamsResult } from './probeMediaStreams.js';

vi.mock('../../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

// child_process.exec uses util.promisify.custom to return { stdout, stderr }.
// vi.hoisted ensures these are defined before the vi.mock factory runs.
const { execMock, execCustom } = vi.hoisted(() => {
    const custom = vi.fn();
    const mock = Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: custom });
    return { execMock: mock, execCustom: custom };
});
vi.mock('child_process', () => ({ exec: execMock }));

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
    params: {},
    config: { studio_url: 'http://mock-studio', store_url: 'http://mock-store' },
    workflow_name: 'test-workflow',
    event: ContentEventName.create,
    objectIds: [objectId],
    input: { inputType: 'objectIds', objectIds: [objectId] },
    vars: {},
    activity: { name: 'probeMediaStreams', params: {} },
});

function mockExec(stdout: string) {
    execCustom.mockResolvedValue({ stdout, stderr: '' });
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
    it('returns hasVideo=true and hasAudio=true for a video+audio container', async () => {
        await setupMockContext('test-object-id', 'https://storage.example.com/file.mp4?token=abc');
        mockExec(JSON.stringify({ streams: [{ codec_type: 'video' }, { codec_type: 'audio' }] }));

        const result: ProbeMediaStreamsResult = await testEnv.run(probeMediaStreams, createPayload());

        expect(result).toEqual({ hasVideo: true, hasAudio: true });
    });

    it('returns hasVideo=true and hasAudio=false for a video-only container', async () => {
        await setupMockContext('test-object-id', 'https://storage.example.com/file.mp4');
        mockExec(JSON.stringify({ streams: [{ codec_type: 'video' }] }));

        const result: ProbeMediaStreamsResult = await testEnv.run(probeMediaStreams, createPayload());

        expect(result).toEqual({ hasVideo: true, hasAudio: false });
    });

    it('returns hasVideo=false and hasAudio=true for an audio-only container (the bug case)', async () => {
        await setupMockContext('test-object-id', 'https://storage.example.com/audio-only.mp4');
        mockExec(JSON.stringify({ streams: [{ codec_type: 'audio' }] }));

        const result: ProbeMediaStreamsResult = await testEnv.run(probeMediaStreams, createPayload());

        expect(result).toEqual({ hasVideo: false, hasAudio: true });
    });

    it('throws nonRetryable ApplicationFailure when no usable streams are found', async () => {
        await setupMockContext('test-object-id', 'https://storage.example.com/bad.mp4');
        mockExec(JSON.stringify({ streams: [] }));

        await expect(testEnv.run(probeMediaStreams, createPayload())).rejects.toThrow(
            'No audio or video streams found in container',
        );
    });

    it('throws DocumentNotFoundError when the object has no source', async () => {
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
            params: {},
        } as unknown as ActivityContext<ProbeMediaStreamsParams>);

        await expect(testEnv.run(probeMediaStreams, createPayload())).rejects.toThrow(
            'has no source',
        );
    });
});
