import type {
    DSLActivityExecutionPayload,
    EmbeddingBatchApplyResponse,
    EmbeddingBatchCapabilityResponse,
    EmbeddingBatchJobResponse,
    EmbeddingBatchPrepareResponse,
    EmbeddingBatchRunState,
    EmbeddingBatchSubjob,
    SupportedEmbeddingTypes,
} from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';

export interface EmbeddingBatchParams {
    run_id: string;
    type: SupportedEmbeddingTypes;
    capability: EmbeddingBatchCapabilityResponse;
}
type JobParams = EmbeddingBatchParams & { subjob: EmbeddingBatchSubjob };
type NamedJobParams = EmbeddingBatchParams & { name: string };
type UpdateParams = {
    run_id: string;
    state: EmbeddingBatchRunState;
    subjobs?: EmbeddingBatchSubjob[];
    error?: { code?: string; message?: string };
};

function requiredCapability(params: EmbeddingBatchParams) {
    const { environment, model, dimensions } = params.capability;
    if (!environment || !model || !dimensions) throw new Error('Incomplete embedding batch capability');
    return { environment, model, dimensions };
}

export async function prepareEmbeddingBatch(
    payload: DSLActivityExecutionPayload<EmbeddingBatchParams>,
): Promise<EmbeddingBatchPrepareResponse> {
    const { client, params } = await setupActivity(payload);
    return client.store.embeddings.prepareBatch({
        run_id: params.run_id,
        embedding_type: params.type,
        capability: params.capability,
    });
}

export async function createEmbeddingBatchJob(
    payload: DSLActivityExecutionPayload<JobParams>,
): Promise<EmbeddingBatchJobResponse> {
    const { client, params } = await setupActivity(payload);
    const capability = requiredCapability(params);
    return client.environments.createEmbeddingBatch(capability.environment, {
        embedding_type: params.type,
        model: capability.model,
        dimensions: capability.dimensions,
        display_name: params.subjob.display_name,
        input_uri: params.subjob.input_uri,
        output_uri: params.subjob.output_uri,
    });
}

export async function getEmbeddingBatchJob(payload: DSLActivityExecutionPayload<NamedJobParams>) {
    const { client, params } = await setupActivity(payload);
    const capability = requiredCapability(params);
    return client.environments.getEmbeddingBatch(capability.environment, {
        embedding_type: params.type,
        model: capability.model,
        name: params.name,
    });
}

export async function cancelEmbeddingBatchJob(payload: DSLActivityExecutionPayload<NamedJobParams>) {
    const { client, params } = await setupActivity(payload);
    const capability = requiredCapability(params);
    return client.environments.cancelEmbeddingBatch(capability.environment, {
        embedding_type: params.type,
        model: capability.model,
        name: params.name,
    });
}

export async function deleteEmbeddingBatchJob(payload: DSLActivityExecutionPayload<NamedJobParams>) {
    const { client, params } = await setupActivity(payload);
    const capability = requiredCapability(params);
    return client.environments.deleteEmbeddingBatch(capability.environment, {
        embedding_type: params.type,
        model: capability.model,
        name: params.name,
    });
}

export async function updateEmbeddingBatch(payload: DSLActivityExecutionPayload<UpdateParams>): Promise<void> {
    const { client, params } = await setupActivity(payload);
    await client.store.embeddings.updateBatch({
        run_id: params.run_id,
        state: params.state,
        subjobs: params.subjobs,
        error_code: params.error?.code,
        error_message: params.error?.message,
    });
}

export async function applyEmbeddingBatch(
    payload: DSLActivityExecutionPayload<{ run_id: string }>,
): Promise<EmbeddingBatchApplyResponse> {
    const { client, params } = await setupActivity(payload);
    return client.store.embeddings.applyBatch({ run_id: params.run_id });
}
