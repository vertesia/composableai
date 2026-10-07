import { Providers } from '@llumiverse/common';
import { createConversationDocument, prepareModelSwitch } from '@llumiverse/conversation';
import type { JsonObjectSchema, JsonValueSchema } from '@llumiverse/conversation/schemas';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
    ExperimentalCanonicalInteractionExecutionRequestSchema,
    ExperimentalCanonicalInteractionHeadersSchema,
    ExperimentalCanonicalInteractionHistorySchema,
    ExperimentalCanonicalInteractionInlinePromptSchema,
    ExperimentalCanonicalInteractionModelSwitchPrepareRequestSchema,
    ExperimentalCanonicalInteractionResultSchemaInputSchema,
    ExperimentalCanonicalInteractionTurnSelectionSchema,
    ExperimentalCanonicalNamedInteractionExecutionRequestSchema,
} from './canonical-interaction-execution.js';
import { ApiSchemaComponents } from './registry.js';

function emittedComponent(schema: z.ZodType, name: string): Record<string, unknown> {
    const emitted = z.toJSONSchema(schema, {
        io: 'input',
        target: 'draft-2020-12',
        unrepresentable: 'any',
    });
    const component = emitted.$defs?.[name];
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
        throw new Error(`Missing emitted component ${name}`);
    }
    return component;
}

describe('experimental canonical interaction execution schemas', () => {
    it('publishes a reference-only dry switch binding and rejects reuse as a new or changed prepare request', async () => {
        const document = createConversationDocument({ id: 'conversation:switch', created_at: '2026-10-03T00:00:00Z' });
        const plan = await prepareModelSwitch(
            document,
            {
                source: { conversation_id: document.id, revision: document.revision },
                expected_context_revision: document.context.revision,
                target: {
                    provider: Providers.openai,
                    protocol: 'openai.responses',
                    model: 'gpt-5.4',
                    adapter_version: '1',
                },
            },
            {
                project: async () => ({ status: 'unsupported', reason: 'Fixture dry projection unavailable' }),
                hasUnsettledGeneration: async () => false,
            },
        );
        const request = {
            interaction: 'interaction:switch',
            initial_state: {
                type: 'reference' as const,
                reference: { run_id: 'run:source', conversation: plan.source },
                operation_id: 'operation:switch',
            },
            retention: 'DEBUG' as const,
            return_policy: { history: 'reference' as const },
        };
        const binding = { plan, request_fingerprint: 'sha256:prospective-request' };
        const bound = { ...request, model_switch: binding };
        const prospective = { request, operation: 'execute' as const };
        expect(ExperimentalCanonicalNamedInteractionExecutionRequestSchema.safeParse(bound).success).toBe(true);
        expect(ExperimentalCanonicalInteractionModelSwitchPrepareRequestSchema.safeParse(prospective).success).toBe(
            true,
        );
        expect(
            ExperimentalCanonicalInteractionModelSwitchPrepareRequestSchema.safeParse({
                request: bound,
                operation: 'execute',
            }).success,
        ).toBe(false);

        const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
        const validateBound = ajv.compile({
            components: { schemas: ApiSchemaComponents },
            $ref: '#/components/schemas/ExperimentalCanonicalNamedInteractionExecutionRequest',
        });
        const validatePrepare = ajv.compile({
            components: { schemas: ApiSchemaComponents },
            $ref: '#/components/schemas/ExperimentalCanonicalInteractionModelSwitchPrepareRequest',
        });
        expect(validateBound(bound), JSON.stringify(validateBound.errors)).toBe(true);
        expect(validatePrepare(prospective), JSON.stringify(validatePrepare.errors)).toBe(true);
        const providerCount = { ...prospective, measurement_mode: 'provider' as const };
        expect(ExperimentalCanonicalInteractionModelSwitchPrepareRequestSchema.safeParse(providerCount).success).toBe(
            true,
        );
        expect(validatePrepare(providerCount), JSON.stringify(validatePrepare.errors)).toBe(true);
        expect(validatePrepare({ ...prospective, measurement_mode: 'silent-provider-call' })).toBe(false);
        expect(validatePrepare({ request: bound, operation: 'execute' })).toBe(false);
        const newRequest = { ...bound, initial_state: { type: 'new' as const } };
        expect(ExperimentalCanonicalNamedInteractionExecutionRequestSchema.safeParse(newRequest).success).toBe(false);
        expect(validateBound(newRequest)).toBe(false);
    });

    it('requires the exact opt-in API version header', () => {
        expect(
            ExperimentalCanonicalInteractionHeadersSchema.parse({
                'x-api-version': '=20260930',
            }),
        ).toEqual({ 'x-api-version': '=20260930' });
        expect(ExperimentalCanonicalInteractionHeadersSchema.safeParse({ 'x-api-version': '20260930' }).success).toBe(
            false,
        );
        expect(ExperimentalCanonicalInteractionHeadersSchema.safeParse({ 'x-api-version': '=20260803' }).success).toBe(
            false,
        );
    });

    it('keeps retention and transient history return policy explicit and independent', () => {
        expect(
            ExperimentalCanonicalInteractionExecutionRequestSchema.parse({
                initial_state: { type: 'new' },
                retention: 'RESTRICTED',
                return_policy: { history: 'document' },
            }),
        ).toEqual({
            initial_state: { type: 'new' },
            retention: 'RESTRICTED',
            return_policy: { history: 'document' },
        });
    });

    it.each([
        ['string', 'memory:input'],
        ['zero', 0],
        ['false', false],
        ['null', null],
        ['array', ['first', 2, false, null, { nested: true }]],
        ['object', { prompt: 'continue', nested: [1, null] }],
    ])('accepts and preserves canonical JSON interaction data: %s', (_label, data) => {
        const request = {
            initial_state: { type: 'new' as const },
            retention: 'STANDARD' as const,
            return_policy: { history: 'none' as const },
            data,
        };

        expect(ExperimentalCanonicalInteractionExecutionRequestSchema.parse(request).data).toEqual(data);
        expect(
            ExperimentalCanonicalNamedInteractionExecutionRequestSchema.parse({
                ...request,
                interaction: 'test-interaction',
            }).data,
        ).toEqual(data);

        const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
        const validate = ajv.compile({
            components: { schemas: ApiSchemaComponents },
            $ref: '#/components/schemas/ExperimentalCanonicalInteractionExecutionRequest',
        });
        expect(validate(request), JSON.stringify(validate.errors)).toBe(true);
    });

    it('publishes canonical interaction data as the authoritative recursive JSON value', () => {
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionExecutionRequest).toMatchObject({
            properties: { data: { $ref: '#/components/schemas/ConversationJsonValue' } },
        });
        expect(ApiSchemaComponents.ExperimentalCanonicalNamedInteractionExecutionRequest).toMatchObject({
            properties: { data: { $ref: '#/components/schemas/ConversationJsonValue' } },
        });
        expectTypeOf<z.infer<typeof ExperimentalCanonicalInteractionExecutionRequestSchema>['data']>().toEqualTypeOf<
            z.infer<typeof JsonValueSchema> | undefined
        >();

        for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, 1n, new Date('2026-10-01T00:00:00.000Z')]) {
            expect(
                ExperimentalCanonicalInteractionExecutionRequestSchema.safeParse({
                    initial_state: { type: 'new' },
                    retention: 'STANDARD',
                    return_policy: { history: 'none' },
                    data: invalid,
                }).success,
            ).toBe(false);
        }
    });

    it.each([
        { mode: 'auto' as const },
        { mode: 'none' as const },
        { mode: 'required' as const },
        { mode: 'required' as const, tool_name: 'lookup' },
    ])('accepts the strict provider-neutral turn selection $mode', (turnSelection) => {
        const request = {
            initial_state: { type: 'new' as const },
            retention: 'STANDARD' as const,
            return_policy: { history: 'none' as const },
            turn_selection: turnSelection,
        };

        expect(ExperimentalCanonicalInteractionExecutionRequestSchema.parse(request).turn_selection).toEqual(
            turnSelection,
        );
    });

    it.each([
        { mode: 'any' },
        { mode: 'auto', tool_name: 'lookup' },
        { mode: 'none', tool_name: 'lookup' },
        { mode: 'required', tool_name: '' },
        { mode: 'required', unknown: true },
    ])('rejects unsupported or ambiguous turn selection %#', (turnSelection) => {
        expect(ExperimentalCanonicalInteractionTurnSelectionSchema.safeParse(turnSelection).success).toBe(false);
    });

    it('emits a strict discriminated turn-selection component for generated clients', () => {
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionTurnSelection).toEqual({
            description: 'Per-turn tool selection. Omission preserves the effective interaction and model defaults.',
            oneOf: [
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionAutoTurnSelection' },
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionNoneTurnSelection' },
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionRequiredTurnSelection' },
            ],
            type: 'object',
            required: ['mode'],
            discriminator: {
                propertyName: 'mode',
                mapping: {
                    auto: '#/components/schemas/ExperimentalCanonicalInteractionAutoTurnSelection',
                    none: '#/components/schemas/ExperimentalCanonicalInteractionNoneTurnSelection',
                    required: '#/components/schemas/ExperimentalCanonicalInteractionRequiredTurnSelection',
                },
            },
        });
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionExecutionRequest).toMatchObject({
            properties: {
                turn_selection: { $ref: '#/components/schemas/ExperimentalCanonicalInteractionTurnSelection' },
            },
        });
    });

    it.each([
        ['unnamed', ExperimentalCanonicalInteractionExecutionRequestSchema, {}],
        ['named', ExperimentalCanonicalNamedInteractionExecutionRequestSchema, { interaction: 'test-interaction' }],
    ])('composes exact optional workflow attribution into the %s request contract', (_label, schema, extra) => {
        const workflow = {
            run_id: 'workflow-run:1',
            workflow_id: 'workflow:1',
            agent_run_id: 'agent-run:1',
            rate_limit_id: 'rate-limit:1',
            activity_type: 'executeInteraction',
        };
        const request = {
            ...extra,
            initial_state: { type: 'new' as const },
            retention: 'STANDARD' as const,
            return_policy: { history: 'none' as const },
            workflow,
        };

        expect(schema.parse(request)).toMatchObject({ workflow });
        expect(schema.safeParse({ ...request, workflow: { ...workflow, unknown: true } }).success).toBe(false);

        const name = schema.meta()?.id;
        if (!name) throw new Error('Canonical interaction request schema has no component id');
        expect(ApiSchemaComponents[name as keyof typeof ApiSchemaComponents]).toMatchObject({
            properties: { workflow: { $ref: '#/components/schemas/ExecutionRunWorkflow' } },
        });
    });

    it('requires a run-bound exact reference and stable handoff operation identity', () => {
        expect(
            ExperimentalCanonicalInteractionExecutionRequestSchema.parse({
                initial_state: {
                    type: 'reference',
                    reference: {
                        run_id: 'run-1',
                        conversation: { conversation_id: 'conversation-1', revision: 7 },
                    },
                    operation_id: 'continue-1',
                },
                retention: 'DEBUG',
                return_policy: { history: 'reference' },
            }),
        ).toMatchObject({
            initial_state: {
                type: 'reference',
                reference: {
                    run_id: 'run-1',
                    conversation: { conversation_id: 'conversation-1', revision: 7 },
                },
                operation_id: 'continue-1',
            },
        });
        expect(
            ExperimentalCanonicalInteractionExecutionRequestSchema.safeParse({
                initial_state: {
                    type: 'reference',
                    reference: { conversation: { conversation_id: 'conversation-1', revision: 7 } },
                    operation_id: 'continue-1',
                },
                retention: 'DEBUG',
                return_policy: { history: 'reference' },
            }).success,
        ).toBe(false);
        expect(
            ExperimentalCanonicalInteractionExecutionRequestSchema.safeParse({
                initial_state: {
                    type: 'reference',
                    reference: {
                        run_id: 'run-1',
                        conversation: { conversation_id: 'conversation-1', revision: 7 },
                    },
                    operation_id: 'continue-1',
                },
                retention: 'STANDARD',
                return_policy: { history: 'reference' },
            }).success,
        ).toBe(false);
    });

    it('publishes named initial-state branches with an exact discriminator mapping for generated clients', () => {
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionInitialState).toMatchObject({
            oneOf: [
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionNewState' },
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionDocumentState' },
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionReferenceState' },
            ],
            discriminator: {
                propertyName: 'type',
                mapping: {
                    new: '#/components/schemas/ExperimentalCanonicalInteractionNewState',
                    document: '#/components/schemas/ExperimentalCanonicalInteractionDocumentState',
                    reference: '#/components/schemas/ExperimentalCanonicalInteractionReferenceState',
                },
            },
        });
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionNewState).toMatchObject({
            properties: { type: { const: 'new' } },
        });
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionDocumentState).toMatchObject({
            properties: { type: { const: 'document' } },
        });
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionReferenceState).toMatchObject({
            properties: { type: { const: 'reference' } },
        });
    });

    it.each([
        ['unnamed', ExperimentalCanonicalInteractionExecutionRequestSchema, {}],
        ['named', ExperimentalCanonicalNamedInteractionExecutionRequestSchema, { interaction: 'test-interaction' }],
    ])('enforces DEBUG reference retention in Zod and the published %s schema', (_label, schema, extra) => {
        const referenceRequest = {
            ...extra,
            initial_state: {
                type: 'reference' as const,
                reference: {
                    run_id: 'run-1',
                    conversation: { conversation_id: 'conversation-1', revision: 7 },
                },
                operation_id: 'continue-1',
            },
            return_policy: { history: 'reference' as const },
        };

        expect(schema.safeParse({ ...referenceRequest, retention: 'DEBUG' }).success).toBe(true);
        expect(schema.safeParse({ ...referenceRequest, retention: 'STANDARD' }).success).toBe(false);

        const name = schema.meta()?.id;
        if (!name) throw new Error('Canonical interaction request schema has no component id');
        const emitted = emittedComponent(schema, name);
        expect(emitted).toMatchObject({
            type: 'object',
            additionalProperties: false,
            properties: {
                initial_state: { $ref: '#/$defs/ExperimentalCanonicalInteractionInitialState' },
            },
        });
        expect(emitted.allOf).toContainEqual({
            if: {
                properties: {
                    initial_state: {
                        properties: { type: { const: 'reference' } },
                        required: ['type'],
                    },
                },
                required: ['initial_state'],
            },
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema's conditional keyword is literally `then`.
            then: {
                properties: { retention: { const: 'DEBUG' } },
                required: ['retention'],
            },
        });
        expect(emitted).not.toHaveProperty('anyOf');
    });

    it('restricts inline prompt definitions to temporary named interactions in Zod and JSON Schema', () => {
        const prompts = [
            {
                role: 'user' as const,
                content: 'Hello {{name}}',
                content_type: 'handlebars' as const,
                schema: { type: 'object', properties: { name: { type: 'string' } } },
            },
        ];
        const base = {
            initial_state: { type: 'new' as const },
            retention: 'STANDARD' as const,
            return_policy: { history: 'none' as const },
        };

        expect(
            ExperimentalCanonicalNamedInteractionExecutionRequestSchema.safeParse({
                ...base,
                interaction: 'tmp:playground-draft',
                prompts,
            }).success,
        ).toBe(true);
        expect(
            ExperimentalCanonicalNamedInteractionExecutionRequestSchema.safeParse({
                ...base,
                interaction: 'tmp:playground-draft',
            }).success,
        ).toBe(false);
        expect(
            ExperimentalCanonicalNamedInteractionExecutionRequestSchema.safeParse({
                ...base,
                interaction: 'stored-interaction',
                prompts,
            }).success,
        ).toBe(false);

        const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
        const validate = ajv.compile({
            components: { schemas: ApiSchemaComponents },
            $ref: '#/components/schemas/ExperimentalCanonicalNamedInteractionExecutionRequest',
        });
        expect(validate({ ...base, interaction: 'tmp:playground-draft', prompts })).toBe(true);
        expect(validate({ ...base, interaction: 'tmp:playground-draft' })).toBe(false);
        expect(validate({ ...base, interaction: 'stored-interaction', prompts })).toBe(false);
        expect(validate({ ...base, interaction: 'stored-interaction' })).toBe(true);

        const promptName = ExperimentalCanonicalInteractionInlinePromptSchema.meta()?.id;
        if (!promptName) throw new Error('Canonical inline prompt schema has no component id');
        expect(emittedComponent(ExperimentalCanonicalInteractionInlinePromptSchema, promptName)).toMatchObject({
            type: 'object',
            additionalProperties: false,
            properties: {
                schema: { $ref: '#/$defs/ConversationJsonObject' },
            },
        });
        expect(
            ExperimentalCanonicalInteractionInlinePromptSchema.safeParse({
                ...prompts[0],
                schema: ['not', 'an', 'object'],
            }).success,
        ).toBe(false);
    });

    it('publishes result_schema as a portable arbitrary object while retaining exact JSON values', () => {
        const resultSchema = {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                nullable: { type: ['string', 'null'] },
                nested: { anyOf: [{ type: 'array', items: { type: 'number' } }, false] },
            },
            additionalProperties: false,
            'x-vertesia-test': { enabled: true, nullable: null, values: [1, false, { nested: 'value' }] },
        };
        const parsed = ExperimentalCanonicalInteractionExecutionRequestSchema.parse({
            initial_state: { type: 'new' },
            retention: 'STANDARD',
            return_policy: { history: 'none' },
            result_schema: resultSchema,
        });

        expect(parsed.result_schema).toEqual(resultSchema);
        const componentName = ExperimentalCanonicalInteractionResultSchemaInputSchema.meta()?.id;
        if (!componentName) throw new Error('Portable result schema input has no component id');
        expect(emittedComponent(ExperimentalCanonicalInteractionResultSchemaInputSchema, componentName)).toEqual({
            anyOf: [{ $ref: '#/$defs/ConversationJsonObject' }, { type: 'null' }],
        });

        for (const invalid of [['not', 'an', 'object'], 'string', 1, true]) {
            expect(ExperimentalCanonicalInteractionResultSchemaInputSchema.safeParse(invalid).success).toBe(false);
        }
        expect(ExperimentalCanonicalInteractionResultSchemaInputSchema.safeParse(null).success).toBe(true);

        expectTypeOf<z.infer<typeof ExperimentalCanonicalInteractionResultSchemaInputSchema>>().toEqualTypeOf<z.infer<
            typeof JsonObjectSchema
        > | null>();

        const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
        const validate = ajv.compile({
            components: { schemas: ApiSchemaComponents },
            $ref: '#/components/schemas/ExperimentalCanonicalInteractionResultSchemaInput',
        });
        expect(validate(resultSchema)).toBe(true);
        expect(validate(null)).toBe(true);
        for (const invalid of [['not', 'an', 'object'], 'string', 1, true]) {
            expect(validate(invalid)).toBe(false);
        }
    });

    it('rejects legacy run_data and unknown request fields instead of silently changing retention', () => {
        expect(
            ExperimentalCanonicalInteractionExecutionRequestSchema.safeParse({
                initial_state: { type: 'new' },
                retention: 'STANDARD',
                return_policy: { history: 'none' },
                config: { run_data: 'DEBUG' },
            }).success,
        ).toBe(false);
        expect(
            ExperimentalCanonicalInteractionExecutionRequestSchema.safeParse({
                initial_state: { type: 'new' },
                retention: 'STANDARD',
                return_policy: { history: 'none' },
                conversation: true,
            }).success,
        ).toBe(false);
    });

    it('requires unavailable history to name the reason rather than fabricating a reference', () => {
        expect(
            ExperimentalCanonicalInteractionHistorySchema.safeParse({
                status: 'unavailable',
                reason: 'retention_policy',
                retention: 'STANDARD',
            }).success,
        ).toBe(true);
        expect(
            ExperimentalCanonicalInteractionHistorySchema.safeParse({
                status: 'reference',
                reference: {
                    run_id: 'run-1',
                    conversation: { conversation_id: 'conversation-1' },
                },
            }).success,
        ).toBe(false);
        expect(
            ExperimentalCanonicalInteractionHistorySchema.safeParse({
                status: 'reference',
                reference: {
                    run_id: 'run-1',
                    conversation: { conversation_id: 'conversation-1', revision: 1 },
                },
            }).success,
        ).toBe(true);
    });
});
