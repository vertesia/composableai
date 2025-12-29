import type { AIModel, EmbeddingsOptions, EmbeddingsResult, ModelSearchPayload } from "@llumiverse/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { ExecutionEnvironment, ExecutionEnvironmentCreatePayload, ExecutionEnvironmentRef, ExecutionEnvironmentUpdatePayload, LoadBalancingEnvConfig, MediatorEnvConfig } from "@vertesia/common";

export default class EnvironmentsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/environments");
    }

    /**
     * List all environments for the current project
     * @param all if true, list all environments, otherwise only the ones for the current project
     */
    list(all: boolean = false): Promise<ExecutionEnvironmentRef[]> {
        const query = all ? { all: true } : undefined;

        return this.get('/', { query });
    }

    create(payload: ExecutionEnvironmentCreatePayload): Promise<ExecutionEnvironment> {
        return this.post('/', {
            payload
        });
    }

    retrieve(id: string): Promise<ExecutionEnvironment> {
        return this.get('/' + id);
    }

    update(id: string, payload: ExecutionEnvironmentUpdatePayload): Promise<ExecutionEnvironment> {
        return this.put('/' + id, {
            payload
        });
    }

    /**
     * Update enabled models and / or config. If enabled_models is not provided, the existing enabled models will not change.
     * Same, if config is not provided the exiting config is not changed.
     * If the config is provided then it will be updated without removing fields that are not provided.
     *
     * @param id
     * @param payload
     * @returns
     */
    updateConfig(id: string, payload: {
        enabled_models?: AIModel[],
        config?: MediatorEnvConfig | LoadBalancingEnvConfig
    }): Promise<ExecutionEnvironment> {
        return this.put('/' + id + '/config', {
            payload
        });
    }

    listModels(id: string, payload?: ModelSearchPayload): Promise<AIModel[]> {
        return this.get('/' + id + '/models', {
            query: payload ? { ...payload } : undefined
        });
    }

    listTrainableModels(id: string): Promise<AIModel[]> {
        return this.get(`/${id}/trainable-models`);
    }

    embeddings(id: string, payload?: EmbeddingsOptions): Promise<EmbeddingsResult> {
        return this.post('/' + id + '/embeddings', {
            payload
        });
    }

    /**
     * Test batch embeddings with a given environment
     * @param id The environment ID to test with
     * @returns Batch job details
     */
    testBatchEmbeddings(id: string): Promise<{
        success: boolean;
        job_id: string;
        job_status: string;
        job_type: string;
        model: string;
    }> {
        return this.post('/' + id + '/test-batch-embeddings');
    }

}
