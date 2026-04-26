import { ApiTopic, ClientBase, ServerSentEvent } from "@vertesia/api-fetch-client";
import {
    IndexingStatusResponse,
    GenericCommandResponse,
    ElasticsearchDocumentData,
    BulkIndexResult,
    CreateReindexTargetResult,
    ReindexRangeResult,
    FetchBatchResult,
    NextIndexCursorResult,
    TriggerReindexResult,
    ElasticsearchIndexStats,
    IndexConfiguration,
    FetchDocumentsByIdsResult,
    BulkDeleteResult,
    EnsureIndexResult,
    AnalyzeDriftBatchResult,
    DriftAnalysisStatusResponse,
    ComputeShardsRequest,
    ComputeShardsResult,
    IndexShardParams,
    IndexShardRequest,
    IndexShardResult,
    SwapAliasRequest,
    SwapAliasResult,
    ReindexViaBulkRequest,
    ReindexViaBulkResult,
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
     * Trigger a full reindex of all documents.
     * Starts a Temporal workflow that uses zeno-bulk for high-throughput indexing.
     *
     * @param options Optional workflow tuning parameters
     */
    async reindex(options?: {
        shard_size?: number;
        parallel_shard_count?: number;
        concurrency?: number;
        bulk_size_bytes?: number;
        bulk_concurrency?: number;
    }): Promise<GenericCommandResponse> {
        return this.post("/reindex", { payload: options });
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
     * Dev branches: store URL contains "zeno-server" -> replace with "zeno-bulk".
     * Production/preview: same domain, LB routes /reindex/* to zeno-bulk.
     */
    private get zenoBulkBaseUrl(): string {
        const storeBaseUrl = this.client.baseUrl;
        if (storeBaseUrl.includes('zeno-server')) {
            return storeBaseUrl.replace(/zeno-server/, 'zeno-bulk');
        }
        return storeBaseUrl;
    }

    /**
     * POST to a zeno-bulk endpoint. Resolves the path against the zeno-bulk base URL.
     */
    private zenoBulkPost<T>(path: string, body: object): Promise<T> {
        return this.client.post(this.zenoBulkBaseUrl + path, { payload: body });
    }

    /**
     * Compute shard boundaries for a tenant via zeno-bulk.
     * Creates the target index and returns shard ranges for parallel indexing.
     */
    computeShards(tenantId: string, shardSize?: number): Promise<ComputeShardsResult> {
        return this.zenoBulkPost('/reindex/compute-shards', {
            tenant_id: tenantId,
            shard_size: shardSize ?? 50000,
        } satisfies ComputeShardsRequest);
    }

    /**
     * Index a single shard via zeno-bulk (retryable by Temporal).
     * The Go service reads from MongoDB and writes to ES directly.
     */
    indexShard(params: IndexShardParams): Promise<IndexShardResult> {
        return this.zenoBulkPost('/reindex/shard', { params } satisfies IndexShardRequest);
    }

    /**
     * Atomically swap ES alias via zeno-bulk.
     * @param alias Optional alias name. If not provided, the Go service derives it from the tenant ID.
     */
    swapAlias(tenantId: string, targetIndex: string, alias?: string): Promise<SwapAliasResult> {
        return this.zenoBulkPost('/reindex/swap-alias', {
            tenant_id: tenantId,
            target_index: targetIndex,
            alias,
        } satisfies SwapAliasRequest);
    }

    /**
     * Full reindex of a tenant via zeno-bulk (all-in-one).
     * The Go service handles sharding, indexing, catch-up, and alias swap internally.
     *
     * In JSON mode (default): waits for completion and returns the final result.
     * In SSE mode (when onEvent is provided): streams progress events from zeno-bulk
     * and returns the final result. The onEvent callback receives parsed SSE events
     * with { event: "progress" | "done", data: string (JSON) }.
     */
    async reindexViaBulk(
        tenantId: string,
        onEvent?: ((event: ServerSentEvent) => void) | null,
        dryRun?: boolean,
    ): Promise<ReindexViaBulkResult> {
        const bulkUrl = this.zenoBulkBaseUrl + '/reindex';
        const payload = {
            tenant_id: tenantId,
            dry_run: dryRun ?? false,
        } satisfies ReindexViaBulkRequest;

        if (!onEvent) {
            return this.client.post(bulkUrl, { payload });
        }

        // SSE mode: stream progress events from zeno-bulk
        let lastResult: ReindexViaBulkResult | undefined;

        await this.client.sseRequest('POST', bulkUrl, {
            payload,
        }, (event) => {
            onEvent(event);
            if (event.type === 'event' && event.event === 'done') {
                try {
                    lastResult = JSON.parse(event.data) as ReindexViaBulkResult;
                } catch {
                    // data might not be valid JSON
                }
            }
        });

        if (!lastResult) {
            throw new Error('zeno-bulk SSE stream ended without a done event');
        }
        return lastResult;
    }
}
