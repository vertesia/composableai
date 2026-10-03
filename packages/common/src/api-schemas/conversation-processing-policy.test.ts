import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { AsyncConversationExecutionPayloadSchema, ConversationProcessingPolicySchema } from './interaction.js';
import { ApiSchemaComponents } from './registry.js';

const policy = {
    enabled: true,
    processors: [
        {
            id: 'externalize-text',
            version: '1',
            scope: 'on_append',
            config: {},
            required: true,
            failure_behavior: 'block',
        },
    ],
    budget: { max_input_tokens: 4000, output_reserve_tokens: 1000, measurement_policy: 'exact_only' },
};
function validator(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    addFormats.default(ajv);
    return ajv.compile({ components: { schemas: ApiSchemaComponents }, $ref: `#/components/schemas/${name}` });
}
describe('workflow automatic processing configuration contract', () => {
    it('roundtrips the exact policy in existing workflow input and named runtime registry', () => {
        expect(ConversationProcessingPolicySchema.parse(policy)).toEqual(policy);
        expect(validator('ConversationProcessingPolicy')(policy)).toBe(true);
        const payload = { type: 'conversation', interaction: 'stored-interaction', processing: policy };
        expect(AsyncConversationExecutionPayloadSchema.parse(payload)).toEqual(payload);
        expect(validator('AsyncConversationExecutionPayload')(payload)).toBe(true);
        expect(
            AsyncConversationExecutionPayloadSchema.parse({ type: 'conversation', interaction: 'stored-interaction' }),
        ).not.toHaveProperty('processing');
    });
    it.each(['policy_revision', 'jobs', 'attempts', 'outputs', 'coverage', 'completions', 'receipts'])(
        'rejects caller-owned durable %s from configuration',
        (field) => {
            const invalid = { ...policy, [field]: {} };
            expect(ConversationProcessingPolicySchema.safeParse(invalid).success).toBe(false);
            expect(validator('ConversationProcessingPolicy')(invalid)).toBe(false);
        },
    );
    it('bounds configured processor count and validates exact processor options and budget', () => {
        for (const invalid of [
            { ...policy, processors: Array.from({ length: 33 }, () => policy.processors[0]) },
            { ...policy, processors: [{ ...policy.processors[0], arbitrary_permission: true }] },
            { ...policy, budget: { ...policy.budget, max_input_tokens: 0 } },
        ]) {
            expect(ConversationProcessingPolicySchema.safeParse(invalid).success).toBe(false);
            expect(validator('ConversationProcessingPolicy')(invalid)).toBe(false);
        }
    });
});
