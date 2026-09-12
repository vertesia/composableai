import { ConversationDocumentSchema } from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { RunDataStorageLevel } from '../interaction-values.js';

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
