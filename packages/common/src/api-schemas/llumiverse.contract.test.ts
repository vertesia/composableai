import type { JSONSchema, ModelOptions } from '@llumiverse/common';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type { JsonObject } from './adapter.js';
import { ApiSchemaComponents, apiComponentRef, validateApiRequest } from './registry.js';

/**
 * The two llumiverse closures the registry publishes: `ModelOptions` with its driver option sets
 * and enums, and `JSONSchema` with its property map.
 *
 * Their schemas live in `@llumiverse/common/schemas` — they describe llumiverse's types, and a copy
 * here would be exactly the drift this migration removes. What is checked HERE is the half that
 * llumiverse cannot see: that the registry publishes them, that the published bytes are what AJV
 * enforces, and that the two closures are open or closed in the direction their contract requires.
 */
function compile(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: ApiSchemaComponents } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const UNION_MEMBERS = [
    'TextFallbackOptions',
    'AzureFoundryChatOptions',
    'ImagenOptions',
    'VertexAIClaudeOptions',
    'VertexAIGeminiOptions',
    'VertexAIGeminiOmniVideoOptions',
    'VertexAIGrokOptions',
    'NovaCanvasOptions',
    'BedrockConverseOptions',
    'BedrockNovaOptions',
    'BedrockMistralOptions',
    'BedrockAI21Options',
    'BedrockCohereCommandOptions',
    'BedrockClaudeOptions',
    'BedrockPalmyraOptions',
    'BedrockGptOssOptions',
    'TwelvelabsPegasusOptions',
    'BedrockMantleResponsesOptions',
    'BedrockMantleChatCompletionsOptions',
    'BedrockMantleClaudeOptions',
    'OpenAiThinkingOptions',
    'OpenAiTextOptions',
    'OpenAiDalleOptions',
    'OpenAiGptImageOptions',
    'XAIGrokImageOptions',
    'GroqOptions',
    'MistralTextOptions',
];

describe('the ModelOptions closure is published whole and enforced closed', () => {
    it('hoists every union member and enum into its own component', () => {
        // The adapter hoists on `.meta({id})`, so a member that lost its id would be inlined into the
        // union instead — the document would still be valid and generated clients would lose the
        // named subtype. Nothing else notices.
        for (const name of [...UNION_MEMBERS, 'ImagenMaskMode', 'ImagenTaskType', 'ThinkingLevel', 'ReasoningEffort']) {
            expect(ApiSchemaComponents[name], name).toBeDefined();
        }
    });

    it('publishes a discriminator whose mapping covers every member', () => {
        const union = ApiSchemaComponents.ModelOptions as JsonObject & {
            oneOf: { $ref: string }[];
            discriminator: { propertyName: string; mapping: Record<string, string> };
        };
        expect(union.discriminator.propertyName).toBe('_option_id');
        expect(union.oneOf.map((member) => member.$ref)).toEqual(
            UNION_MEMBERS.map((name) => `#/components/schemas/${name}`),
        );
        // A mapping short of the `oneOf` is the failure that matters: a generated Java or Go client
        // reads the mapping to pick the concrete subtype and falls back to a loose map without it.
        expect(new Set(Object.values(union.discriminator.mapping))).toEqual(new Set(union.oneOf.map((m) => m.$ref)));
    });

    it('enforces the closure it documents — an undeclared option is rejected, not ignored', () => {
        const validate = compile('ModelOptions');
        const options: ModelOptions = { _option_id: 'text-fallback', max_tokens: 100, temperature: 0.7 };
        expect(validate(options), JSON.stringify(validate.errors)).toBe(true);
        // Both halves matter. `additionalProperties: false` in the document with an AJV that accepts
        // the extra is the spec/enforcement gap this design exists to close; the assertion on the
        // published byte alone would not catch it.
        expect((ApiSchemaComponents.TextFallbackOptions as JsonObject).additionalProperties).toBe(false);
        expect(validate({ _option_id: 'text-fallback', top_p: 0.9, unknown_option: 1 })).toBe(false);
        expect((ApiSchemaComponents.XAIGrokImageOptions as JsonObject).additionalProperties).toBe(false);
        expect(validate({ _option_id: 'xai-grok-image', quality: 'medium', unknown_option: 1 })).toBe(false);
        expect(
            validate({
                _option_id: 'mistral-text',
                effort: 'high',
                random_seed: 42,
                safe_prompt: true,
                include_thoughts: false,
            }),
            JSON.stringify(validate.errors),
        ).toBe(true);
        expect(validate({ _option_id: 'not-a-driver' })).toBe(false);
    });

    it('allows provider-specific objects only inside OpenAI-compatible extra_body', () => {
        const validate = compile('ModelOptions');
        expect(
            validate({
                _option_id: 'openai-text',
                extra_body: {
                    provider: { sort: 'throughput', allow_fallbacks: false },
                    baseten: { performance: 'max' },
                },
            }),
            JSON.stringify(validate.errors),
        ).toBe(true);
        expect(validate({ _option_id: 'openai-text', extra_body: ['invalid'] })).toBe(false);
    });

    it('accepts Gemini Omni task and resolution options through the run request contract', () => {
        const result = validateApiRequest('RunCreatePayload', {
            interaction: 'GenerateVideo',
            config: {
                model: 'locations/global/publishers/google/models/gemini-omni-1.1-flash-preview',
                model_options: {
                    _option_id: 'vertexai-gemini-omni-video',
                    task: 'extend',
                    resolution: '4k',
                },
            },
        });

        expect(result.valid ? [] : result.errors).toEqual([]);
    });
});

describe('the JSONSchema closure is published open, because a JSON Schema is open', () => {
    it('accepts keywords the type never enumerated', () => {
        // The opposite decision from ModelOptions, for the opposite reason. `JSONSchema` names nine
        // fields and real schemas carry `enum`, `oneOf`, `minimum`, `$ref` and the rest. Closing it
        // would 400 nearly every schema a caller sends, so it must publish no `additionalProperties`
        // and AJV must let those keywords through.
        expect((ApiSchemaComponents.JSONSchema as JsonObject).additionalProperties).toBeUndefined();
        const schema: JSONSchema = {
            type: 'object',
            properties: { status: { type: 'string', enum: ['draft', 'live'] } },
            required: ['status'],
            $comment: 'not a declared field',
        };
        const result = validateApiRequest('JSONSchema', schema);
        expect(result.valid ? [] : result.errors).toEqual([]);
    });

    it('still checks the fields it does declare', () => {
        // Open is not unchecked: a declared field with the wrong type is a real contract violation
        // and has to fail, or the component would be documentation rather than a schema.
        expect(validateApiRequest('JSONSchema', { description: 42 }).valid).toBe(false);
        expect(validateApiRequest('JSONSchema', { required: 'status' }).valid).toBe(false);
    });
});
