import { describe, expect, it } from 'vitest';
import { toOpenApiComponents } from './adapter.js';

const branches = {
    Left: { type: 'object', properties: { type: { const: 'left' } }, required: ['type'] },
    Right: { type: 'object', properties: { type: { const: 'right' } }, required: ['type'] },
};
const shared = {
    type: 'object',
    properties: { range: { oneOf: [{ $ref: '#/$defs/Left' }, { $ref: '#/$defs/Right' }] } },
    required: ['range'],
};
const first = {
    type: 'object',
    properties: { value: { $ref: '#/$defs/Shared' } },
    $defs: { Shared: shared, ...branches },
};
const second = {
    type: 'object',
    properties: { value: { $ref: '#/$defs/Shared' } },
    $defs: { ...branches, Shared: shared },
};

describe('complete-graph discriminator synthesis', () => {
    it('adapts identical shared schemas independently of root and definition discovery order', () => {
        const strictComponents = new Set(['Shared', 'Left', 'Right']);
        const forward = toOpenApiComponents({ First: first, Second: second }, { strictComponents });
        const reverse = toOpenApiComponents({ Second: second, First: first }, { strictComponents });
        expect(forward).toEqual(reverse);
        expect(forward.Shared).toEqual({
            type: 'object',
            properties: {
                range: {
                    oneOf: [{ $ref: '#/components/schemas/Left' }, { $ref: '#/components/schemas/Right' }],
                    discriminator: {
                        propertyName: 'type',
                        mapping: { left: '#/components/schemas/Left', right: '#/components/schemas/Right' },
                    },
                    type: 'object',
                    required: ['type'],
                },
            },
            required: ['range'],
            additionalProperties: false,
        });
        expect(forward.Left?.additionalProperties).toBe(false);
        expect(forward.First?.additionalProperties).toBeUndefined();
    });

    it('preserves an explicit discriminator rather than replacing its mapping', () => {
        const explicit = {
            ...shared,
            properties: {
                range: {
                    ...shared.properties.range,
                    discriminator: { propertyName: 'type', mapping: { custom: '#/components/schemas/Left' } },
                },
            },
        };
        const result = toOpenApiComponents({ Root: { ...first, $defs: { ...branches, Shared: explicit } } });
        expect(result.Shared?.properties).toEqual({
            range: {
                oneOf: [{ $ref: '#/components/schemas/Left' }, { $ref: '#/components/schemas/Right' }],
                discriminator: explicit.properties.range.discriminator,
            },
        });
    });

    it('still rejects genuinely conflicting shared definitions before synthesis', () => {
        const conflict = { ...second, $defs: { ...branches, Shared: { ...shared, required: [] } } };
        expect(() => toOpenApiComponents({ First: first, Second: conflict })).toThrow(
            /defined twice with different shapes/,
        );
    });
});
