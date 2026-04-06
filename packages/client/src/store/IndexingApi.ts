import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    IndexingStatusResponse,
    GenericCommandResponse,
    ElasticsearchDocumentData,
    BulkIndexResult,
    CreateReindexTargetResult,
    ReindexRangeResult,
    FetchBatchResult,
    IndexBatchResult,
    NextIndexCursorResult,
    TriggerReindexResult,
    ElasticsearchIndexStats,
    IndexConfiguration,
    FetchDocumentsByIdsResult,
    BulkDeleteResult,
    EnsureIndexResult,
    SwapAliasResult,
    AnalyzeDriftBatchResult,
    DriftAnalysisStatusResponse,
    ComputeShardsRequest,
    ComputeShardsResult,
    IndexShardParams,
    IndexShardResult,
    SwapAliasViaBulkRequest,
    SwapAliasViaBulkResult,
} from "@vertesia/common";

/**
 * API for indexing operations on content objects.
 * Provides status, reindex, and configuration management.
 *
 * Internal endpoints (prefixed with /internal/) are used by Temporal workflow activities
 * and require content_admin permission.
 */
export class IndexingApi extends ApiTopic {

    constructor(parent: ClientBase, basePath: string = "/api/v1/indexing") {
        super(parent, basePath);
    }

    // ========================================================================
    // User-facing endpoints
    // ========================================================================

    /**
     * Get Elasticsearch status for the current project
     */
    async status(): Promise<IndexingStatusResponse> {
        return this.get("/status");
    }

    /**
     * Trigger a full reindex of all documents
     * @param recreateIndex If true, drops and recreates the index before reindexing
     */
    async reindex(recreateIndex?: boolean): Promise<GenericCommandResponse> {
        return this.post("/reindex", { payload: { recreate_index: recreateIndex } });
    }

    /**
     * Trigger an on-demand drift analysis between MongoDB and Elasticsearch
     */
    async analyzeDrift(): Promise<DriftAnalysisStatusResponse> {
        return this.post("/analyze-drift", { payload: {} });
    }

    /**
     * Get the latest drift analysis status/result for this project
     */
    async getDriftAnalysis(): Promise<DriftAnalysisStatusResponse> {
        return this.get("/drift-analysis");
    }

    /**
     * Enable indexing for this project
     */
    async enableIndexing(): Promise<GenericCommandResponse> {
        return this.post("/enable-indexing");
    }

    /**
     * Disable indexing for this project
     */
    async disableIndexing(): Promise<GenericCommandResponse> {
        return this.post("/disable-indexing");
    }

    /**
     * Enable index-based queries for this project
     * @deprecated Queries are now automatically enabled when indexing is enabled
     */
    async enableQueries(): Promise<GenericCommandResponse> {
        return this.post("/enable-queries");
    }

    /**
     * Disable index-based queries for this project
     * @deprecated Queries are now automatically enabled when indexing is enabled
     */
    async disableQueries(): Promise<GenericCommandResponse> {
        return this.post("/disable-queries");
    }

    // ========================================================================
    // Internal endpoints - called by Temporal workflow activities
    // ========================================================================

    /**
     * Index a single document to Elasticsearch
     */
    index(objectId: string, document: ElasticsearchDocumentData): Promise<{ status: string; object_id: string }> {
        return this.post("/internal/index", {
            payload: { object_id: objectId, document },
        });
    }

    /**
     * Delete a document from Elasticsearch
     */
    delete(objectId: string): Promise<{ status: string; object_id: string }> {
        return this.post("/internal/delete", {
            payload: { object_id: objectId },
        });
    }

    /**
     * Bulk index multiple documents to Elasticsearch
     *
     * @param documents Array of documents to index
     * @param targetIndex Optional explicit index name for zero-downtime reindexing
     */
    bulkIndex(
        documents: Array<{ id: string; document: ElasticsearchDocumentData }>,
        targetIndex?: string
    ): Promise<BulkIndexResult> {
        return this.post("/internal/bulk-index", {
            payload: { documents, target_index: targetIndex },
        });
    }

    /**
     * Ensure Elasticsearch index exists for the project
     *
     * @param recreate If true, drops and recreates the index
     */
    ensureIndex(recreate?: boolean): Promise<EnsureIndexResult> {
        return this.post("/internal/ensure-index", {
            payload: { recreate },
        });
    }

    /**
     * Create a new versioned index for reindexing (without alias)
     * The alias will be swapped after reindexing completes via swapAlias
     */
    createReindexTarget(): Promise<CreateReindexTargetResult> {
        return this.post("/internal/create-reindex-target", {
            payload: {},
        });
    }

    /**
     * Atomically swap the alias from old index to new index
     *
     * @param newIndexName The new index to point the alias to
     * @param deleteOld If true, deletes the old index after swapping
     */
    swapAlias(newIndexName: string, deleteOld?: boolean): Promise<SwapAliasResult> {
        return this.post("/internal/swap-alias", {
            payload: { new_index_name: newIndexName, delete_old: deleteOld },
        });
    }

    /**
     * Get Elasticsearch index statistics for the project
     */
    getStats(): Promise<ElasticsearchIndexStats> {
        return this.post("/internal/stats", {
            payload: {},
        });
    }

    /**
     * Get the _id range for reindexing (first, last, count)
     * Used by workflow to set up cursor-based pagination
     */
    getReindexRange(): Promise<ReindexRangeResult> {
        return this.post("/internal/reindex-range", {
            payload: {},
        });
    }

    /**
     * Fetch a batch of documents from MongoDB (without indexing)
     * Used by pipeline approach: fetch next batch while indexing current
     *
     * @param cursor Cursor from previous batch (null for first batch)
     * @param limit Maximum documents to fetch (default: 500)
     */
    fetchBatch(cursor?: string | null, limit?: number): Promise<FetchBatchResult> {
        return this.post("/internal/fetch-batch", {
            payload: { cursor, limit },
        });
    }

    /**
     * Fetch and index a batch of documents (server-side)
     * Uses cursor-based pagination for reliability
     *
     * @param cursor Cursor from previous batch (null for first batch)
     * @param limit Maximum documents to process (default: 500)
     * @param targetIndex Optional explicit index name for zero-downtime reindexing
     * @param since Only index docs with updated_at >= this ISO timestamp (for catch-up after reindex)
     * @param endCursor End cursor (inclusive) for partitioned reindexing
     */
    indexBatch(cursor?: string | null, limit?: number, targetIndex?: string, since?: string, endCursor?: string | null): Promise<IndexBatchResult> {
        return this.post("/internal/index-batch", {
            payload: { cursor, limit, target_index: targetIndex, since, end_cursor: endCursor },
        });
    }

    /**
     * Discover one or more cursor boundaries for partitioned reindexing
     *
     * @param cursor Start cursor (exclusive)
     * @param limit Maximum documents in the partition
     * @param count Maximum number of boundaries to return
     */
    getNextIndexCursor(cursor?: string | null, limit?: number, count?: number): Promise<NextIndexCursorResult> {
        return this.post("/internal/next-cursor", {
            payload: { cursor, limit, count },
        });
    }

    /**
     * Analyze one batch of MongoDB documents against Elasticsearch by _id and updated_at
     */
    analyzeDriftBatch(cursor?: string | null, limit?: number): Promise<AnalyzeDriftBatchResult> {
        return this.post("/internal/analyze-drift-batch", {
            payload: { cursor, limit },
        });
    }

    /**
     * Trigger a reindex operation via Temporal workflow (internal version with more options)
     *
     * @param fullReindex If true, reindexes all documents in the project
     * @param objectIds Specific object IDs to reindex (if not fullReindex)
     * @param recreateIndex If true, recreates the index before reindexing
     */
    triggerReindex(options?: {
        fullReindex?: boolean;
        objectIds?: string[];
        recreateIndex?: boolean;
    }): Promise<TriggerReindexResult> {
        return this.post("/internal/trigger-reindex", {
            payload: options ? {
                full_reindex: options.fullReindex,
                object_ids: options.objectIds,
                recreate_index: options.recreateIndex,
            } : {},
        });
    }

    /**
     * Fetch documents by their IDs from MongoDB (for retry workflow)
     * Returns documents ready for bulk indexing
     *
     * @param objectIds Array of object IDs to fetch
     */
    fetchDocumentsByIds(objectIds: string[]): Promise<FetchDocumentsByIdsResult> {
        return this.post("/internal/fetch-by-ids", {
            payload: { object_ids: objectIds },
        });
    }

    /**
     * Bulk delete documents from Elasticsearch
     *
     * @param objectIds Array of object IDs to delete
     */
    bulkDelete(objectIds: string[]): Promise<BulkDeleteResult> {
        return this.post("/internal/bulk-delete", {
            payload: { object_ids: objectIds },
        });
    }

    /**
     * Get detailed index configuration for the project
     *
     * Returns comprehensive information about the Elasticsearch index including
     * status, embedding dimensions, field mappings, and project configuration.
     */
    getConfiguration(): Promise<IndexConfiguration> {
        return this.post("/internal/configuration", {
            payload: {},
        });
    }

    // ========================================================================
    // Zeno Bulk endpoints (Go migration service)
    // Routes via LB path rules in prod, or derived URL in dev.
    // ========================================================================

    /**
     * Get the zeno-bulk base URL.
     * Dev branches: store URL contains "zeno-server" → replace with "zeno-bulk".
     * Production/preview: same domain, LB routes /reindex/* to zeno-bulk.
     */
    private get zenoBulkBaseUrl(): string {
        const storeBaseUrl = this.client.baseUrl;
        if (storeBaseUrl.includes('zeno-server')) {
            return storeBaseUrl.replace(/zeno-server/, 'zeno-bulk');
        }
        return storeBaseUrl;
    }

    private async zenoBulkPost<T>(path: string, body: unknown): Promise<T> {
        const url = this.zenoBulkBaseUrl + path;
        const req = await this.client.createRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const res = await fetch(req);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`zeno-bulk ${path} failed: ${res.status} ${text}`);
        }
        return await res.json() as T;
    }

    /**
     * Compute shard boundaries for a tenant via zeno-bulk
     */
    computeShards(tenantId: string, shardSize?: number): Promise<ComputeShardsResult> {
        return this.zenoBulkPost('/reindex/compute-shards', {
            tenant_id: tenantId,
            shard_size: shardSize ?? 50000,
        } satisfies ComputeShardsRequest);
    }

    /**
     * Index a single shard via zeno-bulk (retryable by Temporal)
     */
    indexShard(params: IndexShardParams): Promise<IndexShardResult> {
        return this.zenoBulkPost('/reindex/shard', {
            force: true,
            params,
        });
    }

    /**
     * Swap ES alias via zeno-bulk
     */
    swapAliasViaBulk(tenantId: string, targetIndex: string): Promise<SwapAliasViaBulkResult> {
        return this.zenoBulkPost('/reindex/swap-alias', {
            tenant_id: tenantId,
            target_index: targetIndex,
        } satisfies SwapAliasViaBulkRequest);
    }
}
