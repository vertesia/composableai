import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
    AsyncConversationExecutionPayloadSchema,
    ConversationProcessingPolicySchema,
    ConversationToolResultExternalizationPolicySchema,
} from './interaction.js';
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

describe('optional canonical received-original model projection policy', () => {
    const strategy = { version: 1, strategy: 'received_original' };
    it('keeps projection absent by default and roundtrips the exact optional policy through Zod and AJV', () => {
        const ordinary = { type: 'conversation', interaction: 'stored-interaction' };
        expect(AsyncConversationExecutionPayloadSchema.parse(ordinary)).not.toHaveProperty(
            'tool_result_externalization',
        );
        expect(ConversationToolResultExternalizationPolicySchema.parse(strategy)).toEqual(strategy);
        expect(validator('ConversationToolResultExternalizationPolicy')(strategy)).toBe(true);
        const enabled = { ...ordinary, tool_result_externalization: strategy };
        expect(AsyncConversationExecutionPayloadSchema.parse(enabled)).toEqual(enabled);
        expect(validator('AsyncConversationExecutionPayload')(enabled)).toBe(true);
    });
    it.each([
        { version: 2, strategy: 'received_original' },
        { version: 1, strategy: 'automatic' },
        { version: 1, strategy: 'received_original', reader_definition: 'caller-injected' },
        { version: 1, strategy: 'received_original', archive_receipt: {} },
    ])('rejects unsupported or authority-bearing strategy %j', (invalid) => {
        expect(ConversationToolResultExternalizationPolicySchema.safeParse(invalid).success).toBe(false);
        expect(validator('ConversationToolResultExternalizationPolicy')(invalid)).toBe(false);
    });
});
