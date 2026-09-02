import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    EmbeddingBatchApplyRequest,
    EmbeddingBatchApplyResponse,
    EmbeddingBatchPrepareRequest,
    EmbeddingBatchPrepareResponse,
    EmbeddingBatchUpdateRequest,
    EmbeddingsStatusResponse,
    GenericCommandResponse,
    ProjectConfigurationEmbeddingEnablePayload,
    RecalculateEmbeddingsQuery,
    SupportedEmbeddingTypes,
} from '@vertesia/common';

/**
 * @since 0.52.0
 */
export class EmbeddingsApi extends ApiTopic {
    constructor(parent: ClientBase, basePath: string = '/api/v1/embeddings') {
        super(parent, basePath);
    }

    async status(type: SupportedEmbeddingTypes): Promise<EmbeddingsStatusResponse> {
        return this.get(`${type}/status`);
    }

    async activate(
        type: SupportedEmbeddingTypes,
        config: ProjectConfigurationEmbeddingEnablePayload,
    ): Promise<GenericCommandResponse> {
        if (!config.environment) {
            throw new Error('Invalid configuration: select environment');
        }

        return this.post(`${type}/enable`, { payload: config });
    }

    async disable(type: SupportedEmbeddingTypes): Promise<GenericCommandResponse> {
        return this.post(`${type}/disable`);
    }

    async recalculate(
        type: SupportedEmbeddingTypes,
        query: RecalculateEmbeddingsQuery = {},
    ): Promise<GenericCommandResponse> {
        return query.mode ? this.post(`${type}/recalculate`, { query }) : this.post(`${type}/recalculate`);
    }

    async prepareBatch(
        payload: EmbeddingBatchPrepareRequest,
        timeoutMs: number | false | null = false,
    ): Promise<EmbeddingBatchPrepareResponse> {
        return this.post('/batch/prepare', { payload, timeoutMs });
    }

    async updateBatch(payload: EmbeddingBatchUpdateRequest): Promise<GenericCommandResponse> {
        return this.post('/batch/update', { payload });
    }

    async applyBatch(
        payload: EmbeddingBatchApplyRequest,
        timeoutMs: number | false | null = false,
    ): Promise<EmbeddingBatchApplyResponse> {
        return this.post('/batch/apply', { payload, timeoutMs });
    }
}
