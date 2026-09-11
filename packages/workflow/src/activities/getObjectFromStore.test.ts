import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));

import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../errors.js';
import { getObjectFromStore } from './getObjectFromStore.js';

function mockRetrieve(retrieve: ReturnType<typeof vi.fn>) {
    vi.mocked(setupActivity).mockResolvedValue({
        client: { objects: { retrieve } },
        params: {},
        objectId: 'object-1',
    } as never);
}

describe('getObjectFromStore', () => {
    beforeEach(() => vi.clearAllMocks());

    it('summarizes selected text without returning it through the activity result', async () => {
        const retrieve = vi.fn().mockResolvedValue({
            id: 'object-1',
            content: { source: 'gs://bucket/object', type: 'text/html', etag: 'content-etag' },
            text: 'large converted text',
            text_etag: 'content-etag',
            metadata: { content_processor: { type: 'markdown' } },
        });
        vi.mocked(setupActivity).mockResolvedValue({
            client: { objects: { retrieve } },
            params: { select: 'content text text_etag metadata', summarize_text: true },
            objectId: 'object-1',
        } as never);

        const result = await getObjectFromStore({ activity: {} } as never);

        expect(retrieve).toHaveBeenCalledWith('object-1', 'content text text_etag metadata');
        expect(result).toMatchObject({ id: 'object-1', text_length: 20, text_etag: 'content-etag' });
        expect(result).not.toHaveProperty('text');
    });

    it('classifies an oversized retrieval as a permanent retrieval failure rather than a missing document', async () => {
        const cause = Object.assign(new Error('Payload Too Large'), { status: 413 });
        mockRetrieve(vi.fn().mockRejectedValue(cause));

        await expect(getObjectFromStore({ activity: {} } as never)).rejects.toMatchObject({
            type: 'ObjectRetrievalError',
            nonRetryable: true,
            cause,
            details: [413, 'object-1'],
        });
    });

    it('continues to classify a 404 as a missing document', async () => {
        mockRetrieve(vi.fn().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 })));

        await expect(getObjectFromStore({ activity: {} } as never)).rejects.toBeInstanceOf(DocumentNotFoundError);
    });

    it.each([429, 503])('preserves retryable HTTP %s failures', async (status) => {
        const error = Object.assign(new Error(`HTTP ${status}`), { status });
        mockRetrieve(vi.fn().mockRejectedValue(error));

        await expect(getObjectFromStore({ activity: {} } as never)).rejects.toBe(error);
    });
});
