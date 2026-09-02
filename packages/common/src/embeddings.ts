import type { EmbeddingsResult } from '@llumiverse/common';
import type { z } from 'zod';
import type {
    EmbeddingBatchApplyRequestSchema,
    EmbeddingBatchApplyResponseSchema,
    EmbeddingBatchCapabilityRequestSchema,
    EmbeddingBatchCapabilityResponseSchema,
    EmbeddingBatchCreateRequestSchema,
    EmbeddingBatchJobRequestSchema,
    EmbeddingBatchJobResponseSchema,
    EmbeddingBatchPrepareRequestSchema,
    EmbeddingBatchPrepareResponseSchema,
    EmbeddingBatchProviderStateSchema,
    EmbeddingBatchRenditionPageRequestSchema,
    EmbeddingBatchRenditionPageResponseSchema,
    EmbeddingBatchRunStateSchema,
    EmbeddingBatchSubjobSchema,
    EmbeddingBatchUpdateRequestSchema,
    EmbeddingsApiAudioInputSchema,
    EmbeddingsApiImageInputSchema,
    EmbeddingsApiInputSchema,
    EmbeddingsApiRequestSchema,
    EmbeddingsApiSourceSchema,
    EmbeddingsApiTextInputSchema,
    EmbeddingsApiVideoInputSchema,
    RecalculateEmbeddingsQuerySchema,
} from './api-schemas/embeddings.js';

/**
 * The embeddings request types, inferred from `./api-schemas/embeddings.js`. Their documentation
 * moved with them: a doc comment above one of these would be published on top of the schema's own
 * `description`, which is how the union's description came to be the truncated `"…Mirror of"` the
 * document carried for as long as the types lived here.
 */
export type EmbeddingsApiInput = z.infer<typeof EmbeddingsApiInputSchema>;

export type EmbeddingsApiSource = z.infer<typeof EmbeddingsApiSourceSchema>;

export type EmbeddingsApiTextInput = z.infer<typeof EmbeddingsApiTextInputSchema>;

export type EmbeddingsApiImageInput = z.infer<typeof EmbeddingsApiImageInputSchema>;

export type EmbeddingsApiVideoInput = z.infer<typeof EmbeddingsApiVideoInputSchema>;

export type EmbeddingsApiAudioInput = z.infer<typeof EmbeddingsApiAudioInputSchema>;

export type EmbeddingsApiRequest = z.infer<typeof EmbeddingsApiRequestSchema>;

/**
 * Wire-format result. Identical to @llumiverse/common's EmbeddingsResult
 * (vectors and metadata are JSON-friendly), re-exported here for callers
 * that prefer to consume types from @vertesia/common.
 */
export type EmbeddingsApiResult = EmbeddingsResult;
export type RecalculateEmbeddingsQuery = z.infer<typeof RecalculateEmbeddingsQuerySchema>;
export type EmbeddingBatchCapabilityRequest = z.infer<typeof EmbeddingBatchCapabilityRequestSchema>;
export type EmbeddingBatchCapabilityResponse = z.infer<typeof EmbeddingBatchCapabilityResponseSchema>;
export type EmbeddingBatchCreateRequest = z.infer<typeof EmbeddingBatchCreateRequestSchema>;
export type EmbeddingBatchJobRequest = z.infer<typeof EmbeddingBatchJobRequestSchema>;
export type EmbeddingBatchJobResponse = z.infer<typeof EmbeddingBatchJobResponseSchema>;
export type EmbeddingBatchProviderState = z.infer<typeof EmbeddingBatchProviderStateSchema>;
export type EmbeddingBatchRunState = z.infer<typeof EmbeddingBatchRunStateSchema>;
export type EmbeddingBatchSubjob = z.infer<typeof EmbeddingBatchSubjobSchema>;
export type EmbeddingBatchPrepareRequest = z.infer<typeof EmbeddingBatchPrepareRequestSchema>;
export type EmbeddingBatchPrepareResponse = z.infer<typeof EmbeddingBatchPrepareResponseSchema>;
export type EmbeddingBatchRenditionPageRequest = z.infer<typeof EmbeddingBatchRenditionPageRequestSchema>;
export type EmbeddingBatchRenditionPageResponse = z.infer<typeof EmbeddingBatchRenditionPageResponseSchema>;
export type EmbeddingBatchUpdateRequest = z.infer<typeof EmbeddingBatchUpdateRequestSchema>;
export type EmbeddingBatchApplyRequest = z.infer<typeof EmbeddingBatchApplyRequestSchema>;
export type EmbeddingBatchApplyResponse = z.infer<typeof EmbeddingBatchApplyResponseSchema>;
