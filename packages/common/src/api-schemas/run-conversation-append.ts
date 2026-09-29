import {
    ApplicationToolExecutionReceiptSchema,
    AssetSchema,
    ContextEntrySchema,
    ConversationDocumentSchema,
    ConversationRefSchema,
    ExecutedToolTurnSchema,
    IdentifierSchema,
    NonnegativeSafeIntegerSchema,
    OperationReceiptSchema,
    TimestampSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';

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
    })
    .meta({ id: 'AppendRunConversationToolResultsPayload' });

export const AppendRunConversationToolResultsResponseSchema = z
    .strictObject({
        conversation: ConversationRefSchema,
        operation_receipt: OperationReceiptSchema,
        applied: z.boolean(),
    })
    .meta({ id: 'AppendRunConversationToolResultsResponse' });

/** Internal agent-run head publication envelope. The artifact locator remains server-private. */
export const PublishAgentRunConversationHeadPayloadSchema = z
    .strictObject({
        document: ConversationDocumentSchema,
        expected_head: ConversationRefSchema.optional(),
    })
    .meta({ id: 'PublishAgentRunConversationHeadPayload' });
