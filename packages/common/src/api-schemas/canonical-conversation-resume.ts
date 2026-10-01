import {
    AppendConversationRecordsOptionsSchema,
    ConversationRecordBatchSchema,
    IdentifierSchema,
    ReceivedTurnProvenanceSchema,
    UserTurnSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import {
    ExperimentalCanonicalInteractionExecutionConfigurationSchema,
    ExperimentalCanonicalInteractionResultSchemaInputSchema,
    ExperimentalCanonicalInteractionTurnSelectionSchema,
} from './canonical-interaction-execution.js';
import { ExperimentalCanonicalAgentAcceptanceTargetSchema } from './canonical-interaction-stream.js';
import {
    AsyncCompletionOptionsSchema,
    CanonicalContinuationStateSchema,
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

/** Tool outcomes are already retained under materialized_input; no tool/result content mirror travels here. */
export const ExperimentalCanonicalToolResultsPayloadSchema = z
    .strictObject({
        ...resume,
        asyncCompletion: ExperimentalCanonicalAsyncCompletionOptionsSchema.extend({
            canonical_state: CanonicalContinuationStateSchema.extend({
                materialized_input: CanonicalContinuationStateSchema.shape.materialized_input.unwrap(),
            }),
        }),
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
