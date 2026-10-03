import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { ExperimentalCanonicalInitialAuthoringResponseSchema } from './canonical-initial-authoring.js';
import { ApiSchemaComponents } from './registry.js';

function validator(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    addFormats.default(ajv);
    return ajv.compile({ components: { schemas: ApiSchemaComponents }, $ref: `#/components/schemas/${name}` });
}
describe('published initial authoring response', () => {
    it('keeps targetless authoring response distinct from accepted input and generation evidence', () => {
        const response = {
            execution_run_id: 'actual:stored-run',
            source: { conversation_id: 'source:actual', revision: 0 },
        };
        expect(ExperimentalCanonicalInitialAuthoringResponseSchema.parse(response)).toEqual(response);
        const validate = validator('ExperimentalCanonicalInitialAuthoringResponse');
        expect(validate(response)).toBe(true);
        for (const field of ['admission', 'target', 'accepted_input', 'accepted_output', 'segments']) {
            const invalid = { ...response, [field]: {} };
            expect(ExperimentalCanonicalInitialAuthoringResponseSchema.safeParse(invalid).success).toBe(false);
            expect(validate(invalid)).toBe(false);
        }
    });
});
