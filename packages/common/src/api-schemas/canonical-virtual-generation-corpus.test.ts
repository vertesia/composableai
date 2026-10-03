import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    ExperimentalCanonicalInteractionExecutionResultSchema,
    ExperimentalCanonicalVirtualGenerationBindingSchema,
} from './canonical-interaction-execution.js';
import { ApiSchemaComponents } from './registry.js';

const fixture = z
    .strictObject({
        description: z.string(),
        entries: z.array(
            z.strictObject({
                name: z.string(),
                component: z.enum([
                    'ExperimentalCanonicalVirtualGenerationBinding',
                    'ExperimentalCanonicalInteractionExecutionResult',
                ]),
                valid: z.boolean(),
                value: z.unknown(),
            }),
        ),
    })
    .parse(
        JSON.parse(
            readFileSync(new URL('../../test-fixtures/canonical-virtual-generation.json', import.meta.url), 'utf8'),
        ),
    );
const ajv = new Ajv2020({ strict: false });
addFormats.default(ajv);
const validators = {
    ExperimentalCanonicalVirtualGenerationBinding: ajv.compile({
        components: { schemas: ApiSchemaComponents },
        $ref: '#/components/schemas/ExperimentalCanonicalVirtualGenerationBinding',
    }),
    ExperimentalCanonicalInteractionExecutionResult: ajv.compile({
        components: { schemas: ApiSchemaComponents },
        $ref: '#/components/schemas/ExperimentalCanonicalInteractionExecutionResult',
    }),
};
const schemas = {
    ExperimentalCanonicalVirtualGenerationBinding: ExperimentalCanonicalVirtualGenerationBindingSchema,
    ExperimentalCanonicalInteractionExecutionResult: ExperimentalCanonicalInteractionExecutionResultSchema,
};

describe('identical virtual selected-child client corpus', () => {
    it('keeps exact component and case coverage', () => {
        expect(fixture.entries).toHaveLength(27);
        expect(fixture.entries.filter((row) => row.valid)).toHaveLength(4);
        expect(new Set(fixture.entries.map((row) => row.component)).size).toBe(2);
    });
    it.each(fixture.entries)('$name uses the authoritative Zod and exported AJV components', (row) => {
        const parsed = schemas[row.component].safeParse(row.value);
        expect(parsed.success).toBe(row.valid);
        expect(validators[row.component](row.value)).toBe(row.valid);
        if (parsed.success) expect(parsed.data).toEqual(row.value);
    });
});
