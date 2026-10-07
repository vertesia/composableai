import { z } from 'zod';
import {
    ExperimentalCanonicalCheckpointSummaryPayloadSchema,
    ExperimentalCanonicalToolResultsPayloadSchema,
    ExperimentalCanonicalUserMessagePayloadSchema,
} from './canonical-conversation-resume.js';
import {
    ExperimentalCanonicalInitialAgentStreamRequestSchema,
    ExperimentalCanonicalToolApprovalReviewStreamRequestSchema,
} from './canonical-interaction-stream.js';

export const ExperimentalAdmitAgentGenerationInitialPayloadSchema = z
    .strictObject({
        operation: z.literal('initial'),
        request: ExperimentalCanonicalInitialAgentStreamRequestSchema,
    })
    .meta({ id: 'ExperimentalAdmitAgentGenerationInitialPayload' });
export const ExperimentalAdmitAgentGenerationToolApprovalReviewPayloadSchema = z
    .strictObject({
        operation: z.literal('tool_approval_review'),
        request: ExperimentalCanonicalToolApprovalReviewStreamRequestSchema,
    })
    .meta({ id: 'ExperimentalAdmitAgentGenerationToolApprovalReviewPayload' });
export const ExperimentalAdmitAgentGenerationUserPayloadSchema = z
    .strictObject({
        operation: z.literal('user'),
        request: ExperimentalCanonicalUserMessagePayloadSchema,
    })
    .meta({ id: 'ExperimentalAdmitAgentGenerationUserPayload' });
export const ExperimentalAdmitAgentGenerationToolsPayloadSchema = z
    .strictObject({
        operation: z.literal('tools'),
        request: ExperimentalCanonicalToolResultsPayloadSchema,
    })
    .meta({ id: 'ExperimentalAdmitAgentGenerationToolsPayload' });
export const ExperimentalAdmitAgentGenerationCheckpointPayloadSchema = z
    .strictObject({
        operation: z.literal('checkpoint_summary'),
        request: ExperimentalCanonicalCheckpointSummaryPayloadSchema,
    })
    .meta({ id: 'ExperimentalAdmitAgentGenerationCheckpointPayload' });
/** An actual scheduled native request, independently reconstructed by the admitting service. */
export const ExperimentalAdmitAgentGenerationPayloadSchema = z
    .discriminatedUnion('operation', [
        ExperimentalAdmitAgentGenerationInitialPayloadSchema,
        ExperimentalAdmitAgentGenerationToolApprovalReviewPayloadSchema,
        ExperimentalAdmitAgentGenerationUserPayloadSchema,
        ExperimentalAdmitAgentGenerationToolsPayloadSchema,
        ExperimentalAdmitAgentGenerationCheckpointPayloadSchema,
    ])
    .meta({
        id: 'ExperimentalAdmitAgentGenerationPayload',
        type: 'object',
        required: ['operation'],
        discriminator: {
            propertyName: 'operation',
            mapping: {
                initial: '#/components/schemas/ExperimentalAdmitAgentGenerationInitialPayload',
                tool_approval_review: '#/components/schemas/ExperimentalAdmitAgentGenerationToolApprovalReviewPayload',
                user: '#/components/schemas/ExperimentalAdmitAgentGenerationUserPayload',
                tools: '#/components/schemas/ExperimentalAdmitAgentGenerationToolsPayload',
                checkpoint_summary: '#/components/schemas/ExperimentalAdmitAgentGenerationCheckpointPayload',
            },
        },
        additionalProperties: true,
    });
