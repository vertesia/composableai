import type { VertesiaClient } from '@vertesia/client';
import type { Rendition } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { updateObjectMetadata, upsertRendition } from './metadata.js';

function rendition(name: string, source: string): Rendition {
    return { name, content: { source, type: 'image/jpeg', name: `${name}.jpg` } };
}

describe('upsertRendition', () => {
    it('replaces a rendition of the same name and keeps the others', () => {
        const poster = rendition('Poster', 'poster-1');
        const result = upsertRendition([poster, rendition('Web', 'web-1')], rendition('Web', 'web-2'));

        expect(result).toEqual([poster, rendition('Web', 'web-2')]);
    });

    it('appends when no rendition has that name', () => {
        expect(upsertRendition(undefined, rendition('Web', 'web-1'))).toEqual([rendition('Web', 'web-1')]);
    });
});

describe('updateObjectMetadata', () => {
    function client(object: unknown) {
        return {
            objects: {
                retrieve: vi.fn().mockResolvedValue(object),
                update: vi.fn().mockResolvedValue({}),
            },
        } as unknown as VertesiaClient & {
            objects: { retrieve: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
        };
    }

    it('reads only metadata and content, then writes what build returns', async () => {
        const c = client({ metadata: { languages: ['en'] }, content: { etag: 'etag-1' } });

        const updated = await updateObjectMetadata(
            c,
            'object-1',
            ({ metadata, etag }) => ({ metadata: { ...metadata, duration: 3 }, text_etag: etag }),
            { suppressWorkflows: true },
        );

        expect(updated).toBe(true);
        expect(c.objects.retrieve).toHaveBeenCalledWith('object-1', 'metadata content');
        expect(c.objects.update).toHaveBeenCalledWith(
            'object-1',
            { metadata: { languages: ['en'], duration: 3 }, text_etag: 'etag-1' },
            { suppressWorkflows: true },
        );
    });

    it('sends nothing when build returns undefined', async () => {
        const c = client({ content: { etag: 'etag-1' } });

        const updated = await updateObjectMetadata(c, 'object-1', ({ metadata }) => {
            expect(metadata).toBeUndefined();
            return undefined;
        });

        expect(updated).toBe(false);
        expect(c.objects.update).not.toHaveBeenCalled();
    });
});
