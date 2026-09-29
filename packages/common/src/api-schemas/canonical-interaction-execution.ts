import { JSONSchemaSchema } from '@llumiverse/common/schemas';
import {
    ConversationAcceptedOutputFragmentSchema,
    ConversationDocumentSchema,
    ConversationRefSchema,
    JsonObjectSchema,
    TimestampSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE, VERSION_HEADER } from '../versions.js';
import { ExecutionRunStatusSchema, InteractionExecutionErrorSchema, SchemaRefSchema } from './interaction.js';
import { InteractionExecutionConfigurationSchema, RunDataStorageLevelSchema } from './store.js';

export const ExperimentalCanonicalInteractionHeadersSchema = z
    .strictObject({
        [VERSION_HEADER]: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
    })
    .meta({ id: 'ExperimentalCanonicalInteractionHeaders' });

export const ExperimentalCanonicalInteractionInitialStateSchema = z
    .discriminatedUnion('type', [
        z.strictObject({ type: z.literal('new') }),
        z.strictObject({ type: z.literal('document'), document: ConversationDocumentSchema }),
    ])
    .meta({
        id: 'ExperimentalCanonicalInteractionInitialState',
        type: 'object',
        required: ['type'],
        discriminator: { propertyName: 'type' },
    });

export const ExperimentalCanonicalInteractionReturnPolicySchema = z
    .strictObject({ history: z.enum(['document', 'reference', 'none']) })
    .meta({ id: 'ExperimentalCanonicalInteractionReturnPolicy' });

export const ExperimentalCanonicalInteractionExecutionConfigurationSchema =
    InteractionExecutionConfigurationSchema.omit({ run_data: true }).meta({
        id: 'ExperimentalCanonicalInteractionExecutionConfiguration',
    });

export const ExperimentalCanonicalInteractionExecutionRequestSchema = z
    .strictObject({
        initial_state: ExperimentalCanonicalInteractionInitialStateSchema,
        retention: RunDataStorageLevelSchema,
        return_policy: ExperimentalCanonicalInteractionReturnPolicySchema,
        data: JsonObjectSchema.optional(),
        config: ExperimentalCanonicalInteractionExecutionConfigurationSchema.optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema, z.null()]).optional(),
        tags: z.array(z.string()).optional(),
    })
    .meta({ id: 'ExperimentalCanonicalInteractionExecutionRequest' });

export const ExperimentalCanonicalNamedInteractionExecutionRequestSchema =
    ExperimentalCanonicalInteractionExecutionRequestSchema.extend({
        interaction: z.string().min(1),
    }).meta({ id: 'ExperimentalCanonicalNamedInteractionExecutionRequest' });

export const ExperimentalCanonicalInteractionDocumentHistorySchema = z
    .strictObject({
        status: z.literal('document'),
        conversation: ConversationDocumentSchema,
    })
    .meta({ id: 'ExperimentalCanonicalInteractionDocumentHistory' });

export const ExperimentalCanonicalInteractionReferenceHistorySchema = z
    .strictObject({
        status: z.literal('reference'),
        conversation: ConversationRefSchema,
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
