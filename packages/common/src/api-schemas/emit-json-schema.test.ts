import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toOpenApiComponents } from './adapter.js';
import { emitJsonSchema } from './emit-json-schema.js';

describe('explicit union emission', () => {
    it('preserves optional explicit unions and nullable schemas', () => {
        const schema = z.object({
            explicit: z.union([z.string(), z.null()]).optional().describe('Clear with null'),
            nullable: z.string().nullable(),
        });
        const emitted = emitJsonSchema(schema);
        expect(emitted.properties).toEqual({
            explicit: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Clear with null' },
            nullable: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        });
        expect(JSON.stringify(emitted)).not.toContain('x-vertesia-explicit-union');
    });

    it('preserves referenced explicit unions inside named definitions', () => {
        const value = z.union([z.string(), z.boolean(), z.number(), z.null()]).meta({ id: 'Value' });
        const schema = z.object({ value }).meta({ id: 'Holder' });
        const components = toOpenApiComponents({ Holder: emitJsonSchema(schema) });
        expect(components.Value).toEqual({
            anyOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'number' }, { type: 'null' }],
        });
        expect(JSON.stringify(components)).not.toContain('x-vertesia-explicit-union');
    });

    it('retains constraints on union branches', () => {
        expect(emitJsonSchema(z.union([z.string().min(2), z.null()])).anyOf).toEqual([
            { type: 'string', minLength: 2 },
            { type: 'null' },
        ]);
    });
});
