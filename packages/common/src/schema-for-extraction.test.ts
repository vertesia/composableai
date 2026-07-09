import { describe, expect, it } from 'vitest';
import {
    isExtractableSchemaNode,
    mergePreservingNonExtractable,
    schemaForExtraction,
} from './schema-for-extraction.js';

describe('schemaForExtraction', () => {
    it('drops top-level properties marked x-extract: false and cleans required', () => {
        const schema = {
            type: 'object',
            properties: {
                po_number: { type: 'string' },
                match: { type: 'string', 'x-extract': false },
                match_reason: { type: 'string', 'x-extract': false },
            },
            required: ['po_number', 'match'],
        };
        const filtered = schemaForExtraction(schema);
        expect(Object.keys(filtered.properties as object).sort()).toEqual(['po_number']);
        expect(filtered.required).toEqual(['po_number']);
        expect((filtered.properties as Record<string, unknown>).po_number).toEqual({ type: 'string' });
    });

    it('drops nested and array-item properties with x-extract: false', () => {
        const schema = {
            type: 'object',
            properties: {
                line_items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            part_number: { type: 'string' },
                            match: { type: 'string', 'x-extract': false },
                            quantity: { type: 'string' },
                        },
                        required: ['part_number', 'match'],
                    },
                },
            },
        };
        const filtered = schemaForExtraction(schema);
        const items = (filtered.properties as Record<string, Record<string, unknown>>).line_items.items as Record<
            string,
            unknown
        >;
        expect(Object.keys(items.properties as object).sort()).toEqual(['part_number', 'quantity']);
        expect(items.required).toEqual(['part_number']);
    });

    it('treats missing x-extract as extractable', () => {
        expect(isExtractableSchemaNode({ type: 'string' })).toBe(true);
        expect(isExtractableSchemaNode({ type: 'string', 'x-extract': true })).toBe(true);
        expect(isExtractableSchemaNode({ type: 'string', 'x-extract': false })).toBe(false);
    });
});

describe('mergePreservingNonExtractable', () => {
    it('preserves non-extractable top-level values over model output', () => {
        const schema = {
            type: 'object',
            properties: {
                po_number: { type: 'string' },
                match: { type: 'string', 'x-extract': false },
            },
        };
        const existing = { po_number: 'OLD', match: 'erp-hit' };
        const extracted = { po_number: 'NEW', match: 'model-invented' };
        expect(mergePreservingNonExtractable(existing, extracted, schema)).toEqual({
            po_number: 'NEW',
            match: 'erp-hit',
        });
    });

    it('preserves non-extractable fields on array items', () => {
        const schema = {
            type: 'object',
            properties: {
                line_items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            part: { type: 'string' },
                            match: { type: 'string', 'x-extract': false },
                        },
                    },
                },
            },
        };
        const existing = {
            line_items: [
                { part: 'A', match: 'hit-a' },
                { part: 'B', match: 'hit-b' },
            ],
        };
        const extracted = {
            line_items: [{ part: 'A2' }, { part: 'B2' }],
        };
        expect(mergePreservingNonExtractable(existing, extracted, schema)).toEqual({
            line_items: [
                { part: 'A2', match: 'hit-a' },
                { part: 'B2', match: 'hit-b' },
            ],
        });
    });
});
