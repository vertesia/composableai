import { EmbeddingTaskTypeSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';
import { SupportedEmbeddingTypesSchema } from './content.js';

/**
 * The request half of `POST /environments/:envId/embeddings`.
 *
 * The result half is llumiverse's — vectors and counts are already JSON, so `EmbeddingsResult` is
 * the same object on both sides. The request is not: a driver consumes a `DataSource`, which is a
 * stream, so the wire format carries a URL or base64 text instead and the server wraps it before
 * handing the request on.
 */

export const EmbeddingsApiSourceSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Display name for the source (defaults to "embedding-input").' }),
        mime_type: z.string().meta({ description: 'MIME type of the binary content. Required for most providers.' }),
        url: z.string().meta({
            description:
                'Provider-native URL the driver may pass through directly:\n' +
                '- gs:// or https://storage.googleapis.com/ for Vertex AI\n' +
                '- s3:// or https://*.amazonaws.com for Bedrock\n' +
                '- https:// for fetch fallback Mutually exclusive with base64.',
        }),
        base64: z.string().meta({ description: 'Base64-encoded bytes. Mutually exclusive with url.' }),
    })
    .partial()
    .meta({ id: 'EmbeddingsApiSource' });

export const EmbeddingsApiTextInputSchema = z
    .strictObject({
        type: z.literal('text'),
        text: z.string(),
        task_type: EmbeddingTaskTypeSchema.optional(),
        title: z.string().optional(),
    })
    .meta({ id: 'EmbeddingsApiTextInput' });

export const EmbeddingsApiImageInputSchema = z
    .strictObject({
        type: z.literal('image'),
        source: EmbeddingsApiSourceSchema,
    })
    .meta({ id: 'EmbeddingsApiImageInput' });

export const EmbeddingsApiVideoInputSchema = z
    .strictObject({
        type: z.literal('video'),
        source: EmbeddingsApiSourceSchema,
        start_sec: z.number().optional(),
        length_sec: z.number().optional(),
        interval_sec: z.number().optional(),
        use_fixed_length_sec: z.boolean().optional(),
        min_clip_sec: z.number().optional(),
        embedding_option: z.array(z.enum(['visual-text', 'visual-image', 'audio'])).optional(),
    })
    .meta({ id: 'EmbeddingsApiVideoInput' });

export const EmbeddingsApiAudioInputSchema = z
    .strictObject({
        type: z.literal('audio'),
        source: EmbeddingsApiSourceSchema,
        start_sec: z.number().optional(),
        length_sec: z.number().optional(),
    })
    .meta({ id: 'EmbeddingsApiAudioInput' });

export const EmbeddingsApiInputSchema = z
    .discriminatedUnion('type', [
        EmbeddingsApiTextInputSchema,
        EmbeddingsApiImageInputSchema,
        EmbeddingsApiVideoInputSchema,
        EmbeddingsApiAudioInputSchema,
    ])
    .meta({
        id: 'EmbeddingsApiInput',
        description:
            'Wire-format inputs accepted by the studio-server embeddings endpoint. Mirror of ' +
            "@llumiverse/common's EmbeddingInput, but binary modalities carry a JSON-friendly source " +
            '(URL or base64) instead of a DataSource. The server wraps each source in a ' +
            'Base64DataSource or URLDataSource before passing the request to the llumiverse driver.',
    });

export const EmbeddingsApiRequestSchema = z
    .strictObject({
        inputs: z.array(EmbeddingsApiInputSchema),
        embedding_type: SupportedEmbeddingTypesSchema.meta({
            description:
                'Logical project embedding type. This distinguishes properties embeddings from text inputs when ' +
                'the server resolves an omitted model from project settings.',
        }).optional(),
        model: z
            .string()
            .meta({
                description:
                    'Explicit model override intended for validating a configuration before it is saved. Normal ' +
                    'callers should omit this field and provide embedding_type so the project model is resolved.',
            })
            .optional(),
        task_type: EmbeddingTaskTypeSchema.optional(),
        dimensions: z.number().optional(),
    })
    .meta({ id: 'EmbeddingsApiRequest' });

export const EmbeddingsStatusResponseSchema = z
    .strictObject({
        status: z.string(),
        embeddingRunsInProgress: z.number().optional(),
        totalIndexableObjects: z.number().optional(),
        embeddingsModels: z.array(z.string()).optional(),
        objectsWithEmbeddings: z.number().optional(),
        vectorIndex: z.strictObject({
            status: z.enum(['READY', 'PENDING', 'DELETING', 'ABSENT']),
            name: z.string().optional(),
            type: z.string().optional(),
        }),
    })
    .meta({ id: 'EmbeddingsStatusResponse' });

export const RecalculateEmbeddingsQuerySchema = z
    .strictObject({
        mode: z
            .literal('sync')
            .meta({
                description:
                    'Force synchronous per-object recalculation. When omitted, batch inference is used when supported.',
            })
            .optional(),
        // TEMPORARY TEST CONTROL: include objects that already have a current embedding.
        force: z.boolean().optional(),
        // TEMPORARY TEST CONTROL: regenerate JPEG renditions even when one already exists.
        force_renditions: z.boolean().optional(),
    })
    .meta({ id: 'RecalculateEmbeddingsQuery' });

export const ProjectConfigurationEmbeddingEnablePayloadSchema = z
    .strictObject({
        environment: z.string(),
        max_tokens: z.number().optional(),
        model: z.string().optional(),
    })
    .meta({ id: 'ProjectConfigurationEmbeddingEnablePayload' });

export const EmbeddingBatchProviderStateSchema = z.enum([
    'pending',
    'running',
    'succeeded',
    'failed',
    'cancelled',
    'paused',
]);

export const EmbeddingBatchCapabilityRequestSchema = z
    .strictObject({ embedding_type: SupportedEmbeddingTypesSchema })
    .meta({ id: 'EmbeddingBatchCapabilityRequest' });

export const EmbeddingBatchCapabilityResponseSchema = z
    .strictObject({
        eligible: z.boolean(),
        reason: z.string().optional(),
        environment: z.string().optional(),
        provider: z.string().optional(),
        model: z.string().optional(),
        dimensions: z.number().int().positive().optional(),
        max_tokens: z.number().int().positive().optional(),
        location: z.string().optional(),
        input_format: z.string().optional(),
        max_rows: z.number().int().positive().optional(),
        artifact_uri: z.string().optional(),
    })
    .meta({ id: 'EmbeddingBatchCapabilityResponse' });

export const EmbeddingBatchCreateRequestSchema = z
    .strictObject({
        embedding_type: SupportedEmbeddingTypesSchema,
        model: z.string(),
        dimensions: z.number().int().positive(),
        display_name: z.string(),
        input_uri: z.string(),
        output_uri: z.string(),
    })
    .meta({ id: 'EmbeddingBatchCreateRequest' });

export const EmbeddingBatchJobRequestSchema = z
    .strictObject({ embedding_type: SupportedEmbeddingTypesSchema, model: z.string(), name: z.string() })
    .meta({ id: 'EmbeddingBatchJobRequest' });

export const EmbeddingBatchJobResponseSchema = z
    .strictObject({
        name: z.string(),
        display_name: z.string().optional(),
        state: EmbeddingBatchProviderStateSchema,
        model: z.string().optional(),
        input_uri: z.string().optional(),
        output_uri: z.string().optional(),
        error_message: z.string().optional(),
    })
    .meta({ id: 'EmbeddingBatchJobResponse' });

export const EmbeddingBatchRunStateSchema = z.enum([
    'preparing',
    'submitted',
    'running',
    'applying',
    'completed',
    'completed_with_errors',
    'cancelled',
    'stale',
    'failed',
]);

export const EmbeddingBatchPrepareRequestSchema = z
    .strictObject({
        run_id: z.string(),
        embedding_type: SupportedEmbeddingTypesSchema,
        capability: EmbeddingBatchCapabilityResponseSchema,
    })
    .meta({ id: 'EmbeddingBatchPrepareRequest' });

export const EmbeddingBatchSubjobSchema = z.strictObject({
    index: z.number().int().nonnegative(),
    display_name: z.string(),
    input_uri: z.string(),
    output_uri: z.string(),
    row_count: z.number().int().nonnegative(),
    provider_name: z.string().optional(),
    state: EmbeddingBatchProviderStateSchema.optional(),
});

export const EmbeddingBatchPrepareResponseSchema = z
    .strictObject({
        run_id: z.string(),
        row_count: z.number().int().nonnegative(),
        subjobs: z.array(EmbeddingBatchSubjobSchema),
    })
    .meta({ id: 'EmbeddingBatchPrepareResponse' });

export const EmbeddingBatchRenditionPageRequestSchema = z
    .strictObject({ run_id: z.string() })
    .meta({ id: 'EmbeddingBatchRenditionPageRequest' });

export const EmbeddingBatchRenditionPageResponseSchema = z
    .strictObject({
        status: z.enum(['running', 'page_completed', 'completed']),
        page_index: z.number().int().nonnegative(),
        page_scanned: z.number().int().nonnegative(),
        page_ready: z.number().int().nonnegative(),
        page_generated: z.number().int().nonnegative(),
        page_failed: z.number().int().nonnegative(),
        running: z.number().int().nonnegative(),
    })
    .meta({ id: 'EmbeddingBatchRenditionPageResponse' });

export const EmbeddingBatchUpdateRequestSchema = z
    .strictObject({
        run_id: z.string(),
        state: EmbeddingBatchRunStateSchema,
        subjobs: z.array(EmbeddingBatchSubjobSchema).optional(),
        error_code: z.string().optional(),
        error_message: z.string().optional(),
    })
    .meta({ id: 'EmbeddingBatchUpdateRequest' });

export const EmbeddingBatchApplyRequestSchema = z
    .strictObject({ run_id: z.string() })
    .meta({ id: 'EmbeddingBatchApplyRequest' });

export const EmbeddingBatchApplyResponseSchema = z
    .strictObject({
        state: EmbeddingBatchRunStateSchema,
        succeeded: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        stale: z.number().int().nonnegative(),
        applied: z.number().int().nonnegative(),
    })
    .meta({ id: 'EmbeddingBatchApplyResponse' });
