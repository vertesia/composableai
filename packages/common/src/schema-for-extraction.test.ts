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

    it('filters $defs and drops properties that reference non-extractable definitions', () => {
        const schema = {
            type: 'object',
            $defs: {
                hidden: { type: 'string', 'x-extract': false },
                visible: {
                    type: 'object',
                    properties: {
                        value: { type: 'string' },
                        match: { type: 'string', 'x-extract': false },
                    },
                    required: ['value', 'match'],
                },
            },
            properties: {
                hidden: { $ref: '#/$defs/hidden' },
                visible: { $ref: '#/$defs/visible' },
            },
            required: ['hidden', 'visible'],
        };

        const filtered = schemaForExtraction(schema);

        expect(filtered.$defs.hidden).toBeUndefined();
        expect(filtered.$defs.visible).toEqual({
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
        });
        expect(filtered.properties).toEqual({ visible: { $ref: '#/$defs/visible' } });
        expect(filtered.required).toEqual(['visible']);
    });

    it('drops non-extractable anyOf branches', () => {
        const schema = {
            type: 'object',
            properties: {
                value: {
                    anyOf: [{ type: 'string', 'x-extract': false }, { type: 'number' }],
                },
            },
        };

        const filtered = schemaForExtraction(schema);

        expect((filtered.properties.value as { anyOf: unknown[] }).anyOf).toEqual([{ type: 'number' }]);
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

    it('clears extractable fields omitted by the latest extraction', () => {
        const schema = {
            type: 'object',
            properties: {
                po_number: { type: 'string' },
                total: { type: 'number' },
                match: { type: 'string', 'x-extract': false },
            },
        };
        const existing = { po_number: 'STALE', total: 42, match: 'erp-hit' };
        const extracted = { total: 50 };

        expect(mergePreservingNonExtractable(existing, extracted, schema)).toEqual({
            total: 50,
            match: 'erp-hit',
        });
    });

    it('does not preserve non-extractable array item fields by index', () => {
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
            line_items: [{ part: 'B2' }],
        };
        expect(mergePreservingNonExtractable(existing, extracted, schema)).toEqual({
            line_items: [{ part: 'B2' }],
        });
    });

    it('preserves top-level values referenced through non-extractable $defs', () => {
        const schema = {
            type: 'object',
            $defs: {
                match: { type: 'string', 'x-extract': false },
            },
            properties: {
                po_number: { type: 'string' },
                match: { $ref: '#/$defs/match' },
            },
        };
        const existing = { po_number: 'OLD', match: 'erp-hit' };
        const extracted = { po_number: 'NEW', match: 'model-invented' };

        expect(mergePreservingNonExtractable(existing, extracted, schema)).toEqual({
            po_number: 'NEW',
            match: 'erp-hit',
        });
    });
});
