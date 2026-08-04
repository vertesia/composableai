import { z } from 'zod';

export const BulkObjectDeleteResultSchema = z
    .strictObject({
        operation: z.literal('delete'),
        status: z.enum(['in_progress', 'completed', 'failed']),
        deleted: z.number().meta({ description: 'Number of documents deleted (including revisions)' }),
        failed: z
            .array(z.string())
            .meta({ description: 'IDs that were not found or user had no permission to delete' }),
    })
    .meta({ id: 'BulkObjectDeleteResult' });

export const BulkObjectUpdateResultSchema = z
    .strictObject({
        operation: z.literal('update'),
        status: z.enum(['in_progress', 'completed', 'failed']),
        updated: z.number().meta({ description: 'Number of documents successfully updated' }),
        failed: z
            .array(z.string())
            .meta({ description: 'IDs that were not found, not authorized, or failed to update' }),
    })
    .meta({ id: 'BulkObjectUpdateResult' });

export const BulkObjectCreateResultSchema = z
    .strictObject({
        operation: z.literal('create'),
        status: z.enum(['in_progress', 'completed', 'failed']),
        created: z.number().meta({ description: 'Number of documents successfully created' }),
        objects: z
            .array(
                z.strictObject({
                    id: z.string(),
                    index: z.number().optional(),
                    external_id: z.string().optional(),
                }),
            )
            .meta({ description: 'Successfully created objects with their IDs' }),
        failed: z
            .array(
                z.strictObject({
                    external_id: z.string().optional(),
                    index: z.number(),
                    error: z.string(),
                }),
            )
            .meta({ description: 'Objects that failed to create' }),
    })
    .meta({ id: 'BulkObjectCreateResult' });

export const BulkOperationResultSchema = z
    .strictObject({
        operation: z.literal('generic'),
        status: z.enum(['in_progress', 'completed', 'failed']),
    })
    .meta({ id: 'BulkOperationResult' });

export const BulkOperationPayloadSchema = z
    .strictObject({
        name: z
            .enum(['change_type', 'create', 'delete', 'start_workflow', 'update'])
            .meta({ description: 'The operation name' }),
        ids: z.array(z.string()).meta({ description: 'The IDs of the objects to operate on' }),
        params: z.looseObject({}).meta({ description: 'The operation parameters.' }),
    })
    .meta({ id: 'BulkOperationPayload' });

export const BulkOperationResponseSchema = z
    .discriminatedUnion('operation', [
        BulkOperationResultSchema,
        BulkObjectCreateResultSchema,
        BulkObjectUpdateResultSchema,
        BulkObjectDeleteResultSchema,
    ])
    .meta({ id: 'BulkOperationResponse' });
