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
            'Acknowledges the committed operation at the current canonical head. An exact retry after a later append advances the head returns a revision conflict so callers reconcile without repeating tool execution.',
    });

/**
 * Append one controller-owned ordinary program instruction. Callers provide intent text only;
 * the server owns turn authority, provenance, visibility, identifiers, and block construction.
 */
export const AppendRunConversationProgramTurnPayloadSchema = z
    .strictObject({
        conversation_id: IdentifierSchema,
        expected_revision: NonnegativeSafeIntegerSchema,
        operation_id: IdentifierSchema,
        recorded_at: TimestampSchema,
        purpose: z.literal('controller_corrective'),
        text: z.string().min(1).max(MAX_APPEND_RUN_CONVERSATION_PROGRAM_TEXT_CODE_UNITS),
    })
    .meta({ id: 'AppendRunConversationProgramTurnPayload' });

export const AppendRunConversationProgramTurnResponseSchema = z
    .strictObject({
        conversation: ConversationRefSchema,
        operation_receipt: OperationReceiptSchema,
        applied: z.boolean(),
    })
    .meta({
        id: 'AppendRunConversationProgramTurnResponse',
        description:
            'Acknowledges the committed operation at the current canonical head. An exact retry after a later append advances the head returns a revision conflict so callers reconcile without duplicating the program turn.',
    });

/** Internal agent-run head publication envelope. The artifact locator remains server-private. */
export const PublishAgentRunConversationHeadPayloadSchema = z
    .strictObject({
        document: ConversationDocumentSchema,
        expected_head: ConversationRefSchema.optional(),
    })
    .meta({ id: 'PublishAgentRunConversationHeadPayload' });
