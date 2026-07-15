import type { ContentObject, ContentObjectItem } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import {
    type DocumentEditingTargetApi,
    DocumentEditingTargetError,
    resolveDocumentEditingTarget,
} from './documentEditingTarget.js';

function contentObject(id: string, head: boolean, etag = `${id}-etag`): ContentObject {
    return {
        id,
        content: { source: `gs://bucket/${id}.md`, type: 'text/markdown', etag },
        revision: { root: 'root-id', parent: 'root-id', head },
    } as unknown as ContentObject;
}

function revisionItem(id: string, head: boolean): ContentObjectItem {
    return {
        id,
        revision: { root: 'root-id', parent: 'root-id', head },
    } as unknown as ContentObjectItem;
}

function targetApi(): DocumentEditingTargetApi & {
    retrieve: ReturnType<typeof vi.fn<(id: string) => Promise<ContentObject>>>;
    getRevisions: ReturnType<typeof vi.fn<(id: string) => Promise<ContentObjectItem[]>>>;
    getObjectText: ReturnType<typeof vi.fn<(id: string) => Promise<{ text?: string }>>>;
} {
    return {
        retrieve: vi.fn<(id: string) => Promise<ContentObject>>(),
        getRevisions: vi.fn<(id: string) => Promise<ContentObjectItem[]>>(),
        getObjectText: vi.fn<(id: string) => Promise<{ text?: string }>>(),
    };
}

describe('resolveDocumentEditingTarget', () => {
    it('uses a freshly retrieved head revision and its text', async () => {
        const objects = targetApi();
        objects.retrieve.mockResolvedValue(contentObject('head-id', true));
        objects.getObjectText.mockResolvedValue({ text: '# Current head' });

        await expect(resolveDocumentEditingTarget(objects, 'head-id')).resolves.toEqual({
            id: 'head-id',
            etag: 'head-id-etag',
            content: '# Current head',
        });
        expect(objects.getRevisions).not.toHaveBeenCalled();
    });

    it('resolves a historical revision to the unique current head', async () => {
        const objects = targetApi();
        objects.retrieve
            .mockResolvedValueOnce(contentObject('old-id', false))
            .mockResolvedValueOnce(contentObject('head-id', true));
        objects.getRevisions.mockResolvedValue([revisionItem('old-id', false), revisionItem('head-id', true)]);
        objects.getObjectText.mockResolvedValue({ text: '# Current head' });

        await expect(resolveDocumentEditingTarget(objects, 'old-id')).resolves.toEqual({
            id: 'head-id',
            etag: 'head-id-etag',
            content: '# Current head',
        });
        expect(objects.retrieve).toHaveBeenNthCalledWith(2, 'head-id');
        expect(objects.getObjectText).toHaveBeenCalledWith('head-id');
    });

    it('rejects a historical revision when the current head cannot be proven', async () => {
        const objects = targetApi();
        objects.retrieve.mockResolvedValue(contentObject('old-id', false));
        objects.getRevisions.mockResolvedValue([revisionItem('old-id', false)]);

        await expect(resolveDocumentEditingTarget(objects, 'old-id')).rejects.toBeInstanceOf(
            DocumentEditingTargetError,
        );
        expect(objects.getObjectText).not.toHaveBeenCalled();
    });

    it('rejects when the resolved head changes before it can be loaded', async () => {
        const objects = targetApi();
        objects.retrieve
            .mockResolvedValueOnce(contentObject('old-id', false))
            .mockResolvedValueOnce(contentObject('former-head-id', false));
        objects.getRevisions.mockResolvedValue([revisionItem('old-id', false), revisionItem('former-head-id', true)]);

        await expect(resolveDocumentEditingTarget(objects, 'old-id')).rejects.toThrow('is no longer the current head');
        expect(objects.getObjectText).not.toHaveBeenCalled();
    });

    it('rejects a target without a content ETag', async () => {
        const objects = targetApi();
        objects.retrieve.mockResolvedValue(contentObject('head-id', true, ''));

        await expect(resolveDocumentEditingTarget(objects, 'head-id')).rejects.toThrow('has no content ETag');
        expect(objects.getObjectText).not.toHaveBeenCalled();
    });
});
