import {
    AppendConversationRecordsOptionsSchema,
    ConversationMaterializedInputSchema,
    ConversationOutputReceiptSchema,
    ConversationRecordBatchSchema,
    ConversationRefSchema,
    IdentifierSchema,
    ReceivedTurnProvenanceSchema,
    UserTurnSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { ExperimentalAgentRoutingControlSelectorSchema } from './agent-routing-control.js';
import {
    ExperimentalCanonicalInteractionExecutionConfigurationSchema,
    ExperimentalCanonicalInteractionResultSchemaInputSchema,
    ExperimentalCanonicalInteractionTurnSelectionSchema,
} from './canonical-interaction-execution.js';
import { ExperimentalCanonicalAgentAcceptanceTargetSchema } from './canonical-interaction-stream.js';
import {
    AsyncCompletionOptionsSchema,
    CanonicalContinuationStateSchema,
    CanonicalConversationHeadScopeSchema,
    StreamingTelemetryContextSchema,
    UserMessagePayloadSchema,
} from './interaction.js';

export const ExperimentalCanonicalResumeTelemetrySchema = StreamingTelemetryContextSchema.extend({
    context: z.strictObject({
        interaction_id: IdentifierSchema,
        environment_id: IdentifierSchema,
        environment_type: IdentifierSchema,
        model: IdentifierSchema,
        parent_run_id: IdentifierSchema.optional(),
        ancestor_run_ids: z.array(IdentifierSchema).max(128).optional(),
        include_thoughts: z.boolean().optional(),
    }),
}).meta({ id: 'ExperimentalCanonicalResumeTelemetry' });

/** Exact-version callback transport with no current_state or legacy output payload. */
export const ExperimentalCanonicalAsyncCompletionOptionsSchema = AsyncCompletionOptionsSchema.pick({
    run_id: true,
    stream: true,
    streaming: true,
    heartbeat_interval_ms: true,
})
    .extend({
        task_token: z.string().min(1),
        activity_id: IdentifierSchema,
        canonical_state: CanonicalContinuationStateSchema,
        agent_acceptance: ExperimentalCanonicalAgentAcceptanceTargetSchema,
        canonical_output_reference: z.literal('conversation_output_authority_v1'),
        telemetry: ExperimentalCanonicalResumeTelemetrySchema.optional(),
    })
    .meta({ id: 'ExperimentalCanonicalAsyncCompletionOptions' });

/** Native input additions. The server computes the fingerprint and enforces exact scoped CAS. */
export const ExperimentalCanonicalResumeInputAppendSchema = AppendConversationRecordsOptionsSchema.omit({
    payload_fingerprint: true,
})
    .extend({
        records: ConversationRecordBatchSchema.omit({ generations: true, execution_receipts: true }).extend({
            turns: z
                .array(
                    UserTurnSchema.extend({
                        authority: z.literal('ordinary'),
                        model_visibility: z.literal('include'),
                        provenance: ReceivedTurnProvenanceSchema,
                    }),
                )
                .min(1)
                .readonly()
                .optional(),
        }),
    })
    .meta({ id: 'ExperimentalCanonicalResumeInputAppend' });

const resume = {
    run: UserMessagePayloadSchema.shape.run,
    config: ExperimentalCanonicalInteractionExecutionConfigurationSchema.optional(),
    result_schema: ExperimentalCanonicalInteractionResultSchemaInputSchema.optional(),
    turn_selection: ExperimentalCanonicalInteractionTurnSelectionSchema.optional(),
};

/** An explicit continuation anchor selects retained proof; invalid tool proof never falls back to output. */
export const ExperimentalCanonicalContinuationAnchorSchema = z
    .discriminatedUnion('kind', [
        z.strictObject({
            kind: z.literal('materialized_tool_input'),
            materialized_input: ConversationMaterializedInputSchema,
        }),
        z.strictObject({ kind: z.literal('accepted_output'), output_receipt: ConversationOutputReceiptSchema }),
    ])
    .meta({
        id: 'ExperimentalCanonicalContinuationAnchor',
        type: 'object',
        required: ['kind'],
        discriminator: { propertyName: 'kind' },
        additionalProperties: true,
    });

/** Tool outcomes are already retained under materialized_input; no tool/result content mirror travels here. */
export const ExperimentalCanonicalToolResultsPayloadSchema = z
    .strictObject({
        ...resume,
        asyncCompletion: ExperimentalCanonicalAsyncCompletionOptionsSchema,
        continuation_anchor: ExperimentalCanonicalContinuationAnchorSchema,
        input_append: ExperimentalCanonicalResumeInputAppendSchema.extend({
            records: ExperimentalCanonicalResumeInputAppendSchema.shape.records.omit({
                turns: true,
                assets: true,
                context_entries: true,
            }),
        }).optional(),
    })
    .meta({ id: 'ExperimentalCanonicalToolResultsPayload' });

export const ExperimentalCanonicalUserMessagePayloadSchema = z
    .strictObject({
        ...resume,
        asyncCompletion: ExperimentalCanonicalAsyncCompletionOptionsSchema,
        input_append: ExperimentalCanonicalResumeInputAppendSchema.extend({
            records: ExperimentalCanonicalResumeInputAppendSchema.shape.records.extend({
                turns: ExperimentalCanonicalResumeInputAppendSchema.shape.records.shape.turns.unwrap(),
            }),
        }),
    })
    .meta({ id: 'ExperimentalCanonicalUserMessagePayload' });

/** HTTP dispatch acceptance; the durable response receipt is delivered only through the Temporal acknowledgement. */
export const ExperimentalCanonicalResumeAcceptedSchema = z
    .strictObject({
        status: z.literal('accepted'),
        run_id: IdentifierSchema,
        activity_id: IdentifierSchema,
    })
    .meta({ id: 'ExperimentalCanonicalResumeAccepted' });

/** A server-derived summary reads this exact authorized source; it never selects an active publication target. */
export const ExperimentalCanonicalCheckpointSummarySourceSchema = z
    .strictObject({
        subject_agent_run_id: IdentifierSchema,
        conversation: ConversationRefSchema,
        scope: CanonicalConversationHeadScopeSchema,
    })
    .meta({ id: 'ExperimentalCanonicalCheckpointSummarySource' });

/** Token-bearing derivation callback without active owner-head acceptance or an output mirror. */
export const ExperimentalCanonicalCheckpointSummaryPayloadSchema = z
    .strictObject({
        kind: z.literal('checkpoint_summary'),
        run: UserMessagePayloadSchema.shape.run,
        operation_id: IdentifierSchema,
        source: ExperimentalCanonicalCheckpointSummarySourceSchema,
        control: ExperimentalAgentRoutingControlSelectorSchema,
        asyncCompletion: AsyncCompletionOptionsSchema.pick({
            run_id: true,
            heartbeat_interval_ms: true,
        }).extend({
            task_token: z
                .string()
                .min(1)
                .max(64 * 1024),
            activity_id: IdentifierSchema,
        }),
    })
    .meta({ id: 'ExperimentalCanonicalCheckpointSummaryPayload' });

/** Ordinary native user append and derived summary are disjoint strict shapes; the existing branch is unchanged. */
export const ExperimentalCanonicalUserMessageRequestSchema = z
    .union([ExperimentalCanonicalUserMessagePayloadSchema, ExperimentalCanonicalCheckpointSummaryPayloadSchema])
    .meta({ id: 'ExperimentalCanonicalUserMessageRequest', additionalProperties: true });
