import { MockActivityEnvironment } from '@temporalio/testing';
import { RequestError } from '@vertesia/api-fetch-client';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, type DSLActivityExecutionPayload, type Rendition } from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import {
    type AddObjectRenditionParams,
    type AddObjectRenditionResult,
    addObjectRendition,
} from './addObjectRendition.js';

vi.mock('../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

const poster: Rendition = { name: 'Poster', content: { source: 'poster', type: 'image/jpeg', name: 'poster.jpg' } };
const oldWeb: Rendition = { name: 'Web', content: { source: 'web-old', type: 'video/mp4', name: '1920px.mp4' } };
const newWeb: Rendition = { name: 'Web', content: { source: 'web-new', type: 'video/mp4', name: '1920px.mp4' } };

let testEnv: MockActivityEnvironment;
let objects: { retrieve: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

beforeAll(() => {
    testEnv = new MockActivityEnvironment();
});

async function run(params: AddObjectRenditionParams): Promise<AddObjectRenditionResult> {
    return (await testEnv.run(addObjectRendition, payload(params))) as AddObjectRenditionResult;
}

async function setup(params: AddObjectRenditionParams, stored: unknown) {
    const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
    objects = { retrieve: vi.fn().mockResolvedValue(stored), update: vi.fn().mockResolvedValue({}) };
    vi.mocked(setupActivity).mockResolvedValue({
        client: { objects } as unknown as VertesiaClient,
        objectId: 'object-1',
        params,
    } as unknown as ActivityContext<AddObjectRenditionParams>);
}

function payload(params: AddObjectRenditionParams): DSLActivityExecutionPayload<AddObjectRenditionParams> {
    return {
        auth_token: 'test-token',
        account_id: 'test-account',
        project_id: 'test-project',
        params,
        config: { studio_url: 'http://test-studio', store_url: 'http://test-store' },
        workflow_name: 'StandardVideoIntake',
        event: ContentEventName.create,
        objectIds: ['object-1'],
        vars: {},
        activity: { name: 'addObjectRendition', params: { ...params } },
    };
}

describe('addObjectRendition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('replaces the same-named rendition and keeps the rest of the stored metadata', async () => {
        const params = { rendition: newWeb, etag: 'etag-1' };
        await setup(params, {
            metadata: { type: 'video', languages: ['en'], renditions: [poster, oldWeb] },
            content: { etag: 'etag-1' },
        });

        const result = await run(params);

        expect(result.status).toBe('added');
        expect(objects.update).toHaveBeenCalledWith(
            'object-1',
            { metadata: { type: 'video', languages: ['en'], renditions: [poster, newWeb] } },
            { ifMatch: 'etag-1' },
        );
    });

    it('skips a rendition made from content that has since changed', async () => {
        const params = { rendition: newWeb, etag: 'etag-1' };
        await setup(params, { metadata: { renditions: [poster] }, content: { etag: 'etag-2' } });

        const result = await run(params);

        expect(result.status).toBe('skipped');
        expect(objects.update).not.toHaveBeenCalled();
    });

    it('skips when the content changes between the read and the write', async () => {
        const params = { rendition: newWeb, etag: 'etag-1' };
        await setup(params, { metadata: { renditions: [poster] }, content: { etag: 'etag-1' } });
        objects.update.mockRejectedValue(
            new RequestError('Precondition Failed', new Request('http://test-store/objects/object-1'), 412, {}),
        );

        const result = await run(params);

        expect(result.status).toBe('skipped');
    });

    it('rethrows other update failures', async () => {
        const params = { rendition: newWeb, etag: 'etag-1' };
        await setup(params, { metadata: {}, content: { etag: 'etag-1' } });
        objects.update.mockRejectedValue(new Error('network down'));

        await expect(run(params)).rejects.toThrow('network down');
    });
});
