import { PromptRoleSchema } from '@llumiverse/common/schemas';
import {
    Base64Schema,
    ConversationDocumentSchema,
    ConversationRefSchema,
    IdentifierSchema,
    TimestampSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { RunDataStorageLevel } from '../interaction-values.js';
import { CanonicalConversationHeadScopeSchema } from './interaction.js';

export const AvailableRunConversationSchema = z
    .strictObject({
        status: z.literal('available'),
        conversation: ConversationDocumentSchema,
    })
    .meta({ id: 'AvailableRunConversation', description: 'A retained canonical conversation at its stored revision.' });

export const UnavailableRunConversationSchema = z
    .strictObject({
        status: z.literal('unavailable'),
        reason: z.enum(['not_recorded', 'retention_policy', 'pruned']),
        retention: z.enum(RunDataStorageLevel).optional(),
    })
    .meta({ id: 'UnavailableRunConversation', description: 'The run has no retained resumable canonical history.' });

export const RunConversationResponseSchema = z
    .discriminatedUnion('status', [AvailableRunConversationSchema, UnavailableRunConversationSchema])
    .meta({ id: 'RunConversationResponse' });

const MAX_INITIAL_AUTHORING_INPUT_BYTES = 32 * 1024 * 1024;
const InitialAuthoringHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

/** A DEBUG-retained rendered media fact; its decoded length and hash are checked by the host reader. */
export const InitialAuthoringMediaSchema = z
    .strictObject({
        name: z.string().min(1).max(1024),
        mime_type: z.string().min(1).max(1024),
        data_base64: Base64Schema.max(MAX_INITIAL_AUTHORING_INPUT_BYTES),
        byte_length: z.number().int().nonnegative().max(MAX_INITIAL_AUTHORING_INPUT_BYTES),
        content_hash: InitialAuthoringHashSchema,
    })
    .meta({ id: 'InitialAuthoringMedia' });

export const InitialAuthoringSegmentSchema = z
    .strictObject({
        role: PromptRoleSchema,
        content: z.string().max(MAX_INITIAL_AUTHORING_INPUT_BYTES),
        files: z.array(InitialAuthoringMediaSchema).max(4096),
        tool_use_id: IdentifierSchema.optional(),
        tool_result_status: z.enum(['success', 'error', 'cancelled', 'denied']).optional(),
        thought_signature: z
            .string()
            .max(64 * 1024)
            .optional(),
    })
    .meta({ id: 'InitialAuthoringSegment' });

/** Authoring evidence, not a canonical document, generation admission, or prepared request. */
export const InitialAuthoringInputRecordSchema = z
    .strictObject({
        version: z.literal(1),
        run_id: IdentifierSchema,
        account_id: IdentifierSchema,
        project_id: IdentifierSchema,
        retention: z.literal(RunDataStorageLevel.DEBUG),
        subject_agent_run_id: IdentifierSchema,
        owner_agent_run_id: IdentifierSchema,
        scope: CanonicalConversationHeadScopeSchema,
        scheduled_semantic_fingerprint: InitialAuthoringHashSchema,
        initializer_source: ConversationRefSchema,
        input_operation_id: IdentifierSchema,
        base_revision: z.number().int().nonnegative(),
        recorded_at: TimestampSchema,
        definition_fingerprint: InitialAuthoringHashSchema,
        parameters_fingerprint: InitialAuthoringHashSchema,
        authoring_model: z.string().min(1).max(1024).optional(),
        rendered_at: TimestampSchema,
        segments: z.array(InitialAuthoringSegmentSchema).max(4096),
        records_fingerprint: InitialAuthoringHashSchema,
    })
    .meta({ id: 'InitialAuthoringInputRecord' });

export const ExperimentalInitialAuthoringViewQuerySchema = z
    .strictObject({ view: z.literal('initial_authoring') })
    .meta({ id: 'ExperimentalInitialAuthoringViewQuery' });

export const AvailableInitialAuthoringViewSchema = z
    .strictObject({ status: z.literal('available'), input: InitialAuthoringInputRecordSchema })
    .meta({ id: 'AvailableInitialAuthoringView' });

export const UnavailableInitialAuthoringViewSchema = z
    .strictObject({ status: z.literal('unavailable'), reason: z.enum(['not_recorded', 'retention_policy']) })
    .meta({ id: 'UnavailableInitialAuthoringView' });

export const ExperimentalInitialAuthoringViewResponseSchema = z
    .discriminatedUnion('status', [AvailableInitialAuthoringViewSchema, UnavailableInitialAuthoringViewSchema])
    .meta({ id: 'ExperimentalInitialAuthoringViewResponse' });
