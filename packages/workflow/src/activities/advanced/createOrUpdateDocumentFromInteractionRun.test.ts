import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, type DSLActivityExecutionPayload } from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../../dsl/setup/ActivityContext.js';
import { createOrUpdateDocumentFromInteractionRun } from './createOrUpdateDocumentFromInteractionRun.js';

vi.mock('../../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

let testEnv: MockActivityEnvironment;
let update: ReturnType<typeof vi.fn>;

beforeAll(() => {
    testEnv = new MockActivityEnvironment();
});

/**
 * `run.result` is the client's run-result wrapper: `object()` throws when the run produced prose
 * rather than JSON, and `text()` returns the raw completion.
 */
function runResult(json: unknown | undefined, text: string) {
    return {
        object: () => {
            if (json === undefined) {
                throw new Error('not valid JSON');
            }
            return json;
        },
        text: () => text,
    };
}

type ActivityResult = Awaited<ReturnType<typeof createOrUpdateDocumentFromInteractionRun>>;

async function runActivity(): Promise<ActivityResult> {
    return (await testEnv.run(createOrUpdateDocumentFromInteractionRun, createPayload())) as ActivityResult;
}

async function setupRun(json: unknown | undefined, text: string) {
    const { setupActivity } = await import('../../dsl/setup/ActivityContext.js');
    update = vi.fn().mockResolvedValue({ id: 'object-1', name: 'doc' });
    const client = {
        runs: {
            retrieve: vi.fn().mockResolvedValue({
                id: 'run-1',
                modelId: 'test-model',
                parameters: {},
                result: runResult(json, text),
            }),
        },
        objects: { update, create: vi.fn() },
        types: { getTypeByName: vi.fn() },
    } as unknown as VertesiaClient;
    vi.mocked(setupActivity).mockResolvedValue({
        client,
        objectId: 'object-1',
        params: { run_id: 'run-1', update_existing_id: 'object-1' },
    } as unknown as ActivityContext<Record<string, unknown>>);
}

function createPayload(): DSLActivityExecutionPayload<Record<string, unknown>> {
    return {
        auth_token: 'test-token',
        account_id: 'test-account',
        project_id: 'test-project',
        params: {},
        config: { studio_url: 'http://test-studio', store_url: 'http://test-store' },
        workflow_name: 'StandardMediaIntakeWorkflow',
        event: ContentEventName.create,
        objectIds: ['object-1'],
        vars: {},
        activity: {
            name: 'createOrUpdateDocumentFromInteractionRun',
            params: { run_id: 'run-1', update_existing_id: 'object-1' },
        },
    } as unknown as DSLActivityExecutionPayload<Record<string, unknown>>;
}

describe('createOrUpdateDocumentFromInteractionRun', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('writes properties and reports target=properties for a JSON run', async () => {
        await setupRun({ title: 'A title', category: 'report' }, '');

        const result = await runActivity();

        expect(result.target).toBe('properties');
        const docPayload = update.mock.calls[0][1];
        expect(docPayload.properties).toEqual({ title: 'A title', category: 'report' });
        expect(docPayload.text).toBeUndefined();
        expect(docPayload.generation_run_info.target).toBe('properties');
    });

    it('writes text and reports target=text for a prose run', async () => {
        await setupRun(undefined, 'A prose summary of the audio.');

        const result = await runActivity();

        expect(result.target).toBe('text');
        const docPayload = update.mock.calls[0][1];
        expect(docPayload.text).toBe('A prose summary of the audio.');
        expect(docPayload.generation_run_info.target).toBe('text');
    });

    it('omits properties entirely for a prose run so existing properties are not erased', async () => {
        // A `properties: {}` in the update payload is a full replacement server-side, which would
        // wipe whatever the object already carried (and clear its derived embeddings with it).
        await setupRun(undefined, 'A prose summary of the audio.');

        await runActivity();

        const docPayload = update.mock.calls[0][1];
        expect(docPayload.properties).toBeUndefined();
        expect('properties' in docPayload && docPayload.properties !== undefined).toBe(false);
    });
});
