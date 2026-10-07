import {
    ApplicationToolExecutionReceiptSchema,
    AssetSchema,
    ContextEntrySchema,
    ContextRetrievalRequirementSchema,
    ConversationRefSchema,
    ExecutedToolTurnSchema,
    IdentifierSchema,
    JsonBlockSchema,
    NonnegativeSafeIntegerSchema,
    OperationReceiptSchema,
    TextBlockSchema,
    TimestampSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';

export const MAX_APPEND_RUN_CONVERSATION_PROGRAM_TEXT_CODE_UNITS = 64 * 1024;

/** Append-only canonical input records accepted before the next model preparation. */
export const AppendRunConversationToolResultsPayloadSchema = z
    .strictObject({
        conversation_id: IdentifierSchema,
        expected_revision: NonnegativeSafeIntegerSchema,
        operation_id: IdentifierSchema,
        recorded_at: TimestampSchema,
        turns: z.array(ExecutedToolTurnSchema).min(1).readonly(),
        assets: z.array(AssetSchema).readonly().optional(),
        execution_receipts: z.array(ApplicationToolExecutionReceiptSchema).min(1).readonly(),
        context_entries: z.array(ContextEntrySchema).min(1).readonly(),
        retrieval_requirements: z.array(ContextRetrievalRequirementSchema).readonly().optional(),
    })
    .meta({ id: 'AppendRunConversationToolResultsPayload' });

export const AppendRunConversationToolResultsResponseSchema = z
    .strictObject({
        conversation: ConversationRefSchema,
        operation_receipt: OperationReceiptSchema,
        applied: z.boolean(),
    })
    .meta({
        id: 'AppendRunConversationToolResultsResponse',
        description:
            'Acknowledges the original accepted tool operation alongside the observed current head. Exact retained operation/payload retries succeed after later independent advances without repeating tool execution. Proven stale fresh intents or conflicting payloads still return 409.',
    });

/** The server constructs all authority, identifiers and provenance for program results. */
const programAppendIdentity = {
    conversation_id: IdentifierSchema,
    expected_revision: NonnegativeSafeIntegerSchema,
    operation_id: IdentifierSchema,
    recorded_at: TimestampSchema,
};

export const AppendRunConversationProgramTurnPayloadSchema = z
    .discriminatedUnion('purpose', [
        z.strictObject({
            ...programAppendIdentity,
            purpose: z.literal('controller_corrective'),
            text: z.string().min(1).max(MAX_APPEND_RUN_CONVERSATION_PROGRAM_TEXT_CODE_UNITS),
        }),
        z.strictObject({
            ...programAppendIdentity,
            purpose: z.literal('terminal_result'),
            result: z
                .discriminatedUnion('type', [
                    TextBlockSchema.pick({ type: true, text: true }).extend({
                        text: z.string().min(1).max(MAX_APPEND_RUN_CONVERSATION_PROGRAM_TEXT_CODE_UNITS),
                    }),
                    JsonBlockSchema.pick({ type: true, value: true }),
                ])
                .meta({
                    type: 'object',
                    required: ['type'],
                    discriminator: { propertyName: 'type' },
                    // Closedness belongs to the selected strict branch, not the propertyless union wrapper.
                    additionalProperties: true,
                }),
        }),
    ])
    .meta({
        id: 'AppendRunConversationProgramTurnPayload',
        type: 'object',
        required: ['purpose'],
        discriminator: { propertyName: 'purpose' },
        // Each strict branch rejects extras; closing this propertyless wrapper rejects all valid fields.
        additionalProperties: true,
    });

export const AppendRunConversationProgramTurnResponseSchema = z
    .strictObject({
        conversation: ConversationRefSchema,
        operation_receipt: OperationReceiptSchema,
        applied: z.boolean(),
    })
    .meta({
        id: 'AppendRunConversationProgramTurnResponse',
        description:
            'Acknowledges the original accepted program operation alongside the observed current head. Exact retained operation/payload retries succeed after later independent advances without duplicating the program turn. Proven stale fresh intents or conflicting payloads still return 409.',
    });
