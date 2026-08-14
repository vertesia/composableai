import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, type DSLActivityExecutionPayload } from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../errors.js';
import { type TextExtractionResult, TextExtractionStatus } from '../result-types.js';
import { type ExtractDocumentTextParams, extractDocumentText } from './extractDocumentText.js';

vi.mock('../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

vi.mock('../utils/blobs.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../utils/blobs.js')>();
    return { ...actual, fetchBlobAsBuffer: vi.fn() };
});

let testEnv: MockActivityEnvironment;

const SOURCE = 'gs://store/blob-1';
const MIME_TYPE = 'text/plain';

beforeAll(() => {
    testEnv = new MockActivityEnvironment();
});

async function mockObjectMode(doc: Record<string, unknown>) {
    const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
    const client = {
        objects: {
            retrieve: vi.fn().mockResolvedValue(doc),
            update: vi.fn().mockResolvedValue(undefined),
        },
    } as unknown as VertesiaClient;
    vi.mocked(setupActivity).mockResolvedValue({
        client,
        inputType: 'objects',
        objectId: 'object-1',
        objectIds: ['object-1'],
        params: {} satisfies ExtractDocumentTextParams,
    } as unknown as ActivityContext<ExtractDocumentTextParams>);
    return client;
}

function createPayload(): DSLActivityExecutionPayload<ExtractDocumentTextParams> {
    return {
        auth_token: 'test-token',
        account_id: 'test-account',
        project_id: 'test-project',
        params: {},
        config: { studio_url: 'http://test-studio', store_url: 'http://test-store' },
        workflow_name: 'StandardIntake',
        event: ContentEventName.create,
        objectIds: ['object-1'],
        vars: {},
        activity: { name: 'extractDocumentText', params: {} },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('extractDocumentText', () => {
    // Regression: a transient blob-download failure used to be caught and returned as
    // `status: error`. Because the activity *resolved*, Temporal never retried it, intake
    // continued, and the object was marked `completed` with no text — permanently text-less
    // but indistinguishable from a healthy document. It must reject so the retry policy applies.
    it('rejects on a transient download failure instead of resolving with status error', async () => {
        const client = await mockObjectMode({
            id: 'object-1',
            content: { type: MIME_TYPE, source: SOURCE, etag: 'etag-1' },
        });
        const { fetchBlobAsBuffer } = await import('../utils/blobs.js');
        vi.mocked(fetchBlobAsBuffer).mockRejectedValue(new Error(`Failed to download blob ${SOURCE}: Bad Gateway`));

        await expect(testEnv.run(extractDocumentText, createPayload())).rejects.toThrow(/Bad Gateway/);

        // The defining symptom of the old behaviour: the object was still written/completed.
        expect(client.objects.update).not.toHaveBeenCalled();
    });

    // Not-found/forbidden are classified as non-retryable by fetchBlobAsStream. That
    // classification must survive too — retrying a deleted blob five times helps nobody.
    it('propagates a non-retryable DocumentNotFoundError unchanged', async () => {
        await mockObjectMode({
            id: 'object-1',
            content: { type: MIME_TYPE, source: SOURCE, etag: 'etag-1' },
        });
        const { fetchBlobAsBuffer } = await import('../utils/blobs.js');
        vi.mocked(fetchBlobAsBuffer).mockRejectedValue(
            new DocumentNotFoundError(`Not found at ${SOURCE}: not found`, []),
        );

        await expect(testEnv.run(extractDocumentText, createPayload())).rejects.toMatchObject({
            nonRetryable: true,
        });
    });

    it('extracts and stores text on the happy path', async () => {
        const client = await mockObjectMode({
            id: 'object-1',
            content: { type: MIME_TYPE, source: SOURCE, etag: 'etag-1' },
        });
        const { fetchBlobAsBuffer } = await import('../utils/blobs.js');
        vi.mocked(fetchBlobAsBuffer).mockResolvedValue(Buffer.from('hello world'));

        const result = (await testEnv.run(extractDocumentText, createPayload())) as TextExtractionResult;

        expect(result.status).toBe(TextExtractionStatus.success);
        expect(client.objects.update).toHaveBeenCalledWith(
            'object-1',
            expect.objectContaining({ text: 'hello world', text_etag: 'etag-1' }),
        );
    });
});
