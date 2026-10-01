import {
    ConversationAcceptedOutputFragmentSchema,
    ConversationDocumentSchema,
    ConversationRefSchema,
    IdentifierSchema,
    JsonObjectSchema,
    JsonValueSchema,
    TimestampSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { RunDataStorageLevel } from '../interaction-values.js';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE, VERSION_HEADER } from '../versions.js';
import {
    ExecutionRunStatusSchema,
    ExecutionRunWorkflowSchema,
    InCodePromptSchema,
    InteractionExecutionErrorSchema,
} from './interaction.js';
import { InteractionExecutionConfigurationSchema, RunDataStorageLevelSchema } from './store.js';

export const ExperimentalCanonicalInteractionHeadersSchema = z
    .strictObject({
        [VERSION_HEADER]: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
    })
    .meta({ id: 'ExperimentalCanonicalInteractionHeaders' });

export const ExperimentalCanonicalInteractionConversationReferenceSchema = z
    .strictObject({
        run_id: z.string().min(1),
        conversation: ConversationRefSchema,
    })
    .meta({ id: 'ExperimentalCanonicalInteractionConversationReference' });

export const ExperimentalCanonicalInteractionNewStateSchema = z
    .strictObject({ type: z.literal('new') })
    .meta({ id: 'ExperimentalCanonicalInteractionNewState' });

export const ExperimentalCanonicalInteractionDocumentStateSchema = z
    .strictObject({
        type: z.literal('document'),
        document: ConversationDocumentSchema,
    })
    .meta({ id: 'ExperimentalCanonicalInteractionDocumentState' });

export const ExperimentalCanonicalInteractionReferenceStateSchema = z
    .strictObject({
        type: z.literal('reference'),
        reference: ExperimentalCanonicalInteractionConversationReferenceSchema,
        operation_id: IdentifierSchema,
    })
    .meta({ id: 'ExperimentalCanonicalInteractionReferenceState' });

export const ExperimentalCanonicalInteractionInitialStateSchema = z
    .discriminatedUnion('type', [
        ExperimentalCanonicalInteractionNewStateSchema,
        ExperimentalCanonicalInteractionDocumentStateSchema,
        ExperimentalCanonicalInteractionReferenceStateSchema,
    ])
    .meta({
        id: 'ExperimentalCanonicalInteractionInitialState',
        type: 'object',
        required: ['type'],
    });

export const ExperimentalCanonicalInteractionReturnPolicySchema = z
    .strictObject({ history: z.enum(['document', 'reference', 'none']) })
    .meta({ id: 'ExperimentalCanonicalInteractionReturnPolicy' });

export const ExperimentalCanonicalInteractionAutoTurnSelectionSchema = z
    .strictObject({ mode: z.literal('auto') })
    .meta({
        id: 'ExperimentalCanonicalInteractionAutoTurnSelection',
        description: 'Override the effective model-turn tool choice with provider automatic selection.',
    });

export const ExperimentalCanonicalInteractionNoneTurnSelectionSchema = z
    .strictObject({ mode: z.literal('none') })
    .meta({
        id: 'ExperimentalCanonicalInteractionNoneTurnSelection',
        description: "Select the provider's no-tool mode for this model turn.",
    });

export const ExperimentalCanonicalInteractionRequiredTurnSelectionSchema = z
    .strictObject({
        mode: z.literal('required'),
        tool_name: IdentifierSchema.optional(),
    })
    .meta({
        id: 'ExperimentalCanonicalInteractionRequiredTurnSelection',
        description: "Select the provider's required-tool mode, optionally for the exact named active tool.",
    });

/** Provider-neutral selection policy for exactly one canonical model turn. */
export const ExperimentalCanonicalInteractionTurnSelectionSchema = z
    .discriminatedUnion('mode', [
        ExperimentalCanonicalInteractionAutoTurnSelectionSchema,
        ExperimentalCanonicalInteractionNoneTurnSelectionSchema,
        ExperimentalCanonicalInteractionRequiredTurnSelectionSchema,
    ])
    .meta({
        id: 'ExperimentalCanonicalInteractionTurnSelection',
        description: 'Per-turn tool selection. Omission preserves the effective interaction and model defaults.',
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

export const ExperimentalCanonicalInteractionExecutionConfigurationSchema =
    InteractionExecutionConfigurationSchema.omit({ run_data: true }).meta({
        id: 'ExperimentalCanonicalInteractionExecutionConfiguration',
    });

/**
 * Portable wire carrier for an inline JSON Schema or a stored schema reference.
 *
 * The server validates the inline-object branch with llumiverse's authoritative JSONSchemaSchema
 * before it reserves a canonical execution. Publishing the recursive implementation schema here
 * would generate an unusable Java model because its `additionalProperties` JSON Schema keyword
 * collides with the generated model's own additional-properties storage field.
 */
export const ExperimentalCanonicalInteractionResultSchemaInputSchema = z
    .nullable(JsonObjectSchema)
    .meta({ id: 'ExperimentalCanonicalInteractionResultSchemaInput' });

/**
 * Portable prompt authoring input for temporary canonical interactions.
 *
 * The server validates the optional schema object with the authoritative JSONSchemaSchema before
 * reserving an execution. Keeping the recursive implementation schema out of this wire component
 * prevents generated clients from confusing JSON Schema's `additionalProperties` keyword with
 * their own free-form property storage.
 */
export const ExperimentalCanonicalInteractionInlinePromptSchema = InCodePromptSchema.omit({ schema: true })
    .extend({ schema: JsonObjectSchema.optional() })
    .meta({ id: 'ExperimentalCanonicalInteractionInlinePrompt' });

const canonicalExecutionRequestFields = {
    initial_state: ExperimentalCanonicalInteractionInitialStateSchema,
    retention: RunDataStorageLevelSchema,
    return_policy: ExperimentalCanonicalInteractionReturnPolicySchema,
    data: JsonValueSchema.optional(),
    config: ExperimentalCanonicalInteractionExecutionConfigurationSchema.optional(),
    result_schema: ExperimentalCanonicalInteractionResultSchemaInputSchema.optional(),
    turn_selection: ExperimentalCanonicalInteractionTurnSelectionSchema.optional(),
    tags: z.array(z.string()).optional(),
    workflow: ExecutionRunWorkflowSchema.optional(),
};

const referenceDebugRetentionJsonSchema = {
    allOf: [
        {
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
                properties: { retention: { const: RunDataStorageLevel.DEBUG } },
                required: ['retention'],
            },
        },
    ],
} as const;

const namedDraftPromptJsonSchema = {
    allOf: [
        {
            if: {
                properties: { interaction: { type: 'string', pattern: '^tmp:' } },
                required: ['interaction'],
            },
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema's conditional keyword is literally `then`.
            then: { required: ['prompts'] },
            else: { not: { required: ['prompts'] } },
        },
    ],
} as const;

function requireDebugRetentionForReference(
    value: { initial_state: { type: string }; retention: RunDataStorageLevel },
    context: z.core.$RefinementCtx,
): void {
    if (value.initial_state.type === 'reference' && value.retention !== RunDataStorageLevel.DEBUG) {
        context.addIssue({
            code: 'custom',
            message: 'Canonical reference continuation requires DEBUG retention',
            path: ['retention'],
        });
    }
}

function requireDraftPromptsForTemporaryInteraction(
    value: { interaction: string; prompts?: unknown[] },
    context: z.core.$RefinementCtx,
): void {
    const temporary = value.interaction.startsWith('tmp:');
    if (temporary && value.prompts === undefined) {
        context.addIssue({
            code: 'custom',
            message: 'Temporary canonical interactions require inline prompts',
            path: ['prompts'],
        });
    } else if (!temporary && value.prompts !== undefined) {
        context.addIssue({
            code: 'custom',
            message: 'Inline prompts are only valid for temporary canonical interactions',
            path: ['prompts'],
        });
    }
}

export const ExperimentalCanonicalInteractionExecutionRequestSchema = z
    .strictObject(canonicalExecutionRequestFields)
    .superRefine(requireDebugRetentionForReference)
    .meta({
        id: 'ExperimentalCanonicalInteractionExecutionRequest',
        ...referenceDebugRetentionJsonSchema,
    });

export const ExperimentalCanonicalNamedInteractionExecutionRequestSchema = z
    .strictObject({
        ...canonicalExecutionRequestFields,
        interaction: z.string().min(1),
        prompts: z
            .array(ExperimentalCanonicalInteractionInlinePromptSchema)
            .meta({ description: 'Inline prompt definitions for a temporary `tmp:` interaction.' })
            .optional(),
    })
    .superRefine((value, context) => {
        requireDebugRetentionForReference(value, context);
        requireDraftPromptsForTemporaryInteraction(value, context);
    })
    .meta({
        id: 'ExperimentalCanonicalNamedInteractionExecutionRequest',
        allOf: [...referenceDebugRetentionJsonSchema.allOf, ...namedDraftPromptJsonSchema.allOf],
    });

export const ExperimentalCanonicalInteractionDocumentHistorySchema = z
    .strictObject({
        status: z.literal('document'),
        conversation: ConversationDocumentSchema,
    })
    .meta({ id: 'ExperimentalCanonicalInteractionDocumentHistory' });

export const ExperimentalCanonicalInteractionReferenceHistorySchema = z
    .strictObject({
        status: z.literal('reference'),
        reference: ExperimentalCanonicalInteractionConversationReferenceSchema,
    })
    .meta({ id: 'ExperimentalCanonicalInteractionReferenceHistory' });

export const ExperimentalCanonicalInteractionUnavailableHistorySchema = z
    .strictObject({
        status: z.literal('unavailable'),
        reason: z.enum(['not_requested', 'not_recorded', 'retention_policy', 'pruned']),
        retention: RunDataStorageLevelSchema.optional(),
    })
    .meta({ id: 'ExperimentalCanonicalInteractionUnavailableHistory' });

export const ExperimentalCanonicalInteractionHistorySchema = z
    .discriminatedUnion('status', [
        ExperimentalCanonicalInteractionDocumentHistorySchema,
        ExperimentalCanonicalInteractionReferenceHistorySchema,
        ExperimentalCanonicalInteractionUnavailableHistorySchema,
    ])
    .meta({
        id: 'ExperimentalCanonicalInteractionHistory',
        type: 'object',
        required: ['status'],
        discriminator: {
            propertyName: 'status',
            mapping: {
                document: '#/components/schemas/ExperimentalCanonicalInteractionDocumentHistory',
                reference: '#/components/schemas/ExperimentalCanonicalInteractionReferenceHistory',
                unavailable: '#/components/schemas/ExperimentalCanonicalInteractionUnavailableHistory',
            },
        },
    });

export const ExperimentalCanonicalInteractionRunSchema = z
    .strictObject({
        id: z.string().min(1),
        status: ExecutionRunStatusSchema,
        interaction: z.string().min(1).optional(),
        created_at: TimestampSchema,
        updated_at: TimestampSchema,
        retention: RunDataStorageLevelSchema,
        error: InteractionExecutionErrorSchema.optional(),
    })
    .meta({ id: 'ExperimentalCanonicalInteractionRun' });

export const ExperimentalCanonicalInteractionAcceptedOutputSchema = z
    .strictObject({
        status: z.literal('accepted'),
        fragment: ConversationAcceptedOutputFragmentSchema,
    })
    .meta({ id: 'ExperimentalCanonicalInteractionAcceptedOutput' });

export const ExperimentalCanonicalInteractionUnavailableOutputSchema = z
    .strictObject({
        status: z.literal('unavailable'),
        reason: z.enum(['no_accepted_response', 'not_recorded', 'pruned']),
    })
    .meta({ id: 'ExperimentalCanonicalInteractionUnavailableOutput' });

export const ExperimentalCanonicalInteractionOutputSchema = z
    .discriminatedUnion('status', [
        ExperimentalCanonicalInteractionAcceptedOutputSchema,
        ExperimentalCanonicalInteractionUnavailableOutputSchema,
    ])
    .meta({
        id: 'ExperimentalCanonicalInteractionOutput',
        type: 'object',
        required: ['status'],
        discriminator: {
            propertyName: 'status',
            mapping: {
                accepted: '#/components/schemas/ExperimentalCanonicalInteractionAcceptedOutput',
                unavailable: '#/components/schemas/ExperimentalCanonicalInteractionUnavailableOutput',
            },
        },
    });

export const ExperimentalCanonicalInteractionExecutionResultSchema = z
    .strictObject({
        run: ExperimentalCanonicalInteractionRunSchema,
        output: ExperimentalCanonicalInteractionOutputSchema,
        history: ExperimentalCanonicalInteractionHistorySchema,
    })
    .meta({ id: 'ExperimentalCanonicalInteractionExecutionResult' });
