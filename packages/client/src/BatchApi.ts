import type { BatchJob, CreateBatchJobOptions, ListBatchJobsOptions, ListBatchJobsResult } from "@llumiverse/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";

export default class BatchApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/batch");
    }

    /**
     * List batch jobs for a given environment
     * @param envId The environment ID
     * @param options Optional list options (pageSize, pageToken, filter)
     */
    list(envId: string, options?: ListBatchJobsOptions): Promise<ListBatchJobsResult<any, any>> {
        return super.get('/', {
            query: {
                envId,
                ...options
            }
        });
    }

    /**
     * Create a new batch job
     * @param envId The environment ID
     * @param options Batch job creation options
     */
    create(envId: string, options: CreateBatchJobOptions<any, any>): Promise<BatchJob<any, any>> {
        return this.post('/', {
            payload: {
                envId,
                ...options
            }
        });
    }

    /**
     * Get details of a specific batch job
     * @param batchId The batch job ID
     * @param envId The environment ID
     */
    retrieve(batchId: string, envId: string): Promise<BatchJob<any, any>> {
        return super.get('/' + batchId, {
            query: { envId }
        });
    }

    /**
     * Cancel a running batch job
     * @param batchId The batch job ID
     * @param envId The environment ID
     */
    cancel(batchId: string, envId: string): Promise<BatchJob<any, any>> {
        return this.post('/' + batchId + '/cancel', {
            query: { envId }
        });
    }

    /**
     * Delete a batch job
     * @param batchId The batch job ID
     * @param envId The environment ID
     */
    remove(batchId: string, envId: string): Promise<void> {
        return super.delete('/' + batchId, {
            query: { envId }
        });
    }

    /**
     * Test batch embeddings with a given environment
     * @param envId The environment ID to test with
     * @param model Optional model to use (defaults to gemini-embedding-001)
     * @returns Batch job details
     */
    testBatchEmbeddings(envId: string, model?: string): Promise<{
        success: boolean;
        job_id: string;
        job_status: string;
        job_type: string;
        model: string;
    }> {
        return this.post('/test-batch-embeddings', {
            payload: {
                envId,
                model
            }
        });
    }
}
