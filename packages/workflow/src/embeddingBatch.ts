import type { EmbeddingBatchCapabilityResponse, SupportedEmbeddingTypes } from '@vertesia/common';

export interface EmbeddingBatchParams {
    run_id: string;
    type: SupportedEmbeddingTypes;
    capability: EmbeddingBatchCapabilityResponse;
}
