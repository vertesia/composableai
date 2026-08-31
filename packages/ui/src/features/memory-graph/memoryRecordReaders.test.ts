// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mapMemoryQueryHits, readQualifiers } from './memoryRecordReaders.js';

describe('mapMemoryQueryHits', () => {
    const hits = [
        { id: 'record-1', source: { name: 'Microsoft', properties: { entity_id: 'microsoft' } } },
        { id: 'record-2', source: { name: 'OpenAI', properties: { entity_id: 'openai' } } },
    ];

    it('flattens the hit id over its source document', () => {
        expect(mapMemoryQueryHits(hits, 2, 10)).toEqual([
            { id: 'record-1', name: 'Microsoft', properties: { entity_id: 'microsoft' } },
            { id: 'record-2', name: 'OpenAI', properties: { entity_id: 'openai' } },
        ]);
    });

    it('lets the source document override the hit id', () => {
        // The hit id is a seed, not an override: Elasticsearch keeps the document id out of
        // `_source`, so a document that does carry one is the more authoritative copy.
        expect(mapMemoryQueryHits([{ id: 'hit-id', source: { id: 'document-id', name: 'X' } }], 1, 10)[0].id).toBe(
            'document-id',
        );
    });

    it('tolerates a missing or non-object source', () => {
        expect(mapMemoryQueryHits([{ id: 'a' }, { id: 'b', source: 'nope' }], 2, 10)).toEqual([
            { id: 'a' },
            { id: 'b' },
        ]);
    });

    it('treats an absent hit list as empty', () => {
        expect(mapMemoryQueryHits(undefined, undefined, 10)).toEqual([]);
    });

    it('refuses to draw a truncated graph when the corpus exceeds the limit', () => {
        expect(() => mapMemoryQueryHits(hits, 2400, 2)).toThrowError(
            'Memory graph query matched 2400 records but the explorer safely loads at most 2',
        );
    });

    it('accepts a total that matches the returned hits', () => {
        expect(mapMemoryQueryHits(hits, 2, 2)).toHaveLength(2);
    });

    it('falls back to the hit count when the backend omits the total', () => {
        expect(mapMemoryQueryHits(hits, undefined, 2)).toHaveLength(2);
    });
});

describe('readQualifiers', () => {
    it('keeps scalar entries and drops everything else', () => {
        expect(readQualifiers({ commodity: 'GPUs', megawatts: 250, nested: {}, blank: '  ', nan: Number.NaN })).toEqual(
            { commodity: 'GPUs', megawatts: 250 },
        );
    });

    it('is undefined when nothing usable survives', () => {
        expect(readQualifiers({ nested: { a: 1 } })).toBeUndefined();
        expect(readQualifiers(undefined)).toBeUndefined();
    });
});
