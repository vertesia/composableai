import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../dsl/setup/ActivityContext.js', () => ({ setupActivity: vi.fn() }));

import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { getObjectFromStore } from './getObjectFromStore.js';

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
});
