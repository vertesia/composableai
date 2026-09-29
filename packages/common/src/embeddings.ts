import type { EmbeddingsResult } from '@llumiverse/common';
import type * as Wire from './wire-types.generated.js';

/**
 * The embeddings request types, inferred from `./api-schemas/embeddings.js`. Their documentation
 * moved with them: a doc comment above one of these would be published on top of the schema's own
 * `description`, which is how the union's description came to be the truncated `"…Mirror of"` the
 * document carried for as long as the types lived here.
 */
export type EmbeddingsApiInput = Wire.EmbeddingsApiInput;

export type EmbeddingsApiSource = Wire.EmbeddingsApiSource;

export type EmbeddingsApiTextInput = Wire.EmbeddingsApiTextInput;

export type EmbeddingsApiImageInput = Wire.EmbeddingsApiImageInput;

export type EmbeddingsApiVideoInput = Wire.EmbeddingsApiVideoInput;

export type EmbeddingsApiAudioInput = Wire.EmbeddingsApiAudioInput;

export type EmbeddingsApiRequest = Wire.EmbeddingsApiRequest;

/**
 * Wire-format result. Identical to @llumiverse/common's EmbeddingsResult
 * (vectors and metadata are JSON-friendly), re-exported here for callers
 * that prefer to consume types from @vertesia/common.
 */
export type EmbeddingsApiResult = EmbeddingsResult;
export type RecalculateEmbeddingsQuery = Wire.RecalculateEmbeddingsQuery;
export type EmbeddingBatchCapabilityRequest = Wire.EmbeddingBatchCapabilityRequest;
export type EmbeddingBatchCapabilityResponse = Wire.EmbeddingBatchCapabilityResponse;
export type EmbeddingBatchCreateRequest = Wire.EmbeddingBatchCreateRequest;
export type EmbeddingBatchJobRequest = Wire.EmbeddingBatchJobRequest;
export type EmbeddingBatchJobResponse = Wire.EmbeddingBatchJobResponse;
export type EmbeddingBatchProviderState = Wire.EmbeddingBatchProviderState;
export type EmbeddingBatchRunState = Wire.EmbeddingBatchRunState;
export type EmbeddingBatchRunSummary = Wire.EmbeddingBatchRunSummary;
export type EmbeddingBatchSubjob = Wire.EmbeddingBatchSubjob;
export type EmbeddingBatchPrepareRequest = Wire.EmbeddingBatchPrepareRequest;
export type EmbeddingBatchPrepareResponse = Wire.EmbeddingBatchPrepareResponse;
export type EmbeddingBatchRenditionPageRequest = Wire.EmbeddingBatchRenditionPageRequest;
export type EmbeddingBatchRenditionPageResponse = Wire.EmbeddingBatchRenditionPageResponse;
export type EmbeddingBatchUpdateRequest = Wire.EmbeddingBatchUpdateRequest;
export type EmbeddingBatchApplyRequest = Wire.EmbeddingBatchApplyRequest;
export type EmbeddingBatchApplyResponse = Wire.EmbeddingBatchApplyResponse;
