import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ExperimentalCanonicalVirtualGenerationBindingSchema } from './canonical-interaction-execution.js';
import { ApiSchemaComponents } from './registry.js';

const valid = {
    version: 1,
    parent_request_id: 'parent',
    plan_fingerprint: `sha256:${'a'.repeat(64)}`,
    child_environment_id: 'environment',
    child_model: 'model',
    child_provider: 'openai',
    configured_occurrence: 0,
    child_identity: 'virtual_candidate:environment:model:0',
    child_request_id: 'parent:virtual_candidate:environment:model:0',
    response_operation_id: 'parent:response:virtual_candidate:environment:model:0',
    generation_id: 'generation',
    turn_id: 'turn',
    source: { conversation_id: 'conversation', revision: 2 },
};
const validate = new Ajv2020({ strict: false, validateFormats: false }).compile({
    components: { schemas: ApiSchemaComponents },
    $ref: '#/components/schemas/ExperimentalCanonicalVirtualGenerationBinding',
});

describe('published experimental concrete virtual winner data', () => {
    it('uses the identical strict component in Zod and emitted AJV', () => {
        expect(ExperimentalCanonicalVirtualGenerationBindingSchema.parse(valid)).toEqual(valid);
        expect(validate(valid)).toBe(true);
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionExecutionResult.properties).toMatchObject({
            virtual_generation: { $ref: '#/components/schemas/ExperimentalCanonicalVirtualGenerationBinding' },
        });
    });
    it.each([
        { ...valid, version: 2 },
        { ...valid, configured_occurrence: 256 },
        { ...valid, child_provider: 'virtual_lb' },
        { ...valid, plan_fingerprint: 'claimed' },
        { ...valid, child_environment_id: '' },
        { ...valid, parent_request_id: 'x'.repeat(4097) },
        { ...valid, capability: 'caller-authored' },
        { ...valid, child_model: null },
    ])('rejects invalid wire values through both authoritative validators', (invalid) => {
        expect(ExperimentalCanonicalVirtualGenerationBindingSchema.safeParse(invalid).success).toBe(false);
        expect(validate(invalid)).toBe(false);
    });
    it('requires every named witness field, including occurrence zero', () => {
        for (const key of Object.keys(valid)) {
            const invalid: Record<string, unknown> = { ...valid };
            delete invalid[key];
            expect(ExperimentalCanonicalVirtualGenerationBindingSchema.safeParse(invalid).success).toBe(false);
            expect(validate(invalid)).toBe(false);
        }
    });
});
