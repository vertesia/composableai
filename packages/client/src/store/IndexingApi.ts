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
    TriggerReindexResult,
    ElasticsearchIndexStats,
    IndexConfiguration,
    FetchDocumentsByIdsResult,
    BulkDeleteResult,
    EnsureIndexResult,
    SwapAliasResult,
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
        return this.post("/reindex", { payload: { recreateIndex } });
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
    index(objectId: string, document: ElasticsearchDocumentData): Promise<{ status: string; objectId: string }> {
        return this.post("/internal/index", {
            payload: { objectId, document },
        });
    }

    /**
     * Delete a document from Elasticsearch
     */
    delete(objectId: string): Promise<{ status: string; objectId: string }> {
        return this.post("/internal/delete", {
            payload: { objectId },
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
            payload: { documents, targetIndex },
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
            payload: { newIndexName, deleteOld },
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
     */
    indexBatch(cursor?: string | null, limit?: number, targetIndex?: string, since?: string): Promise<IndexBatchResult> {
        return this.post("/internal/index-batch", {
            payload: { cursor, limit, targetIndex, since },
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
            payload: options ?? {},
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
            payload: { objectIds },
        });
    }

    /**
     * Bulk delete documents from Elasticsearch
     *
     * @param objectIds Array of object IDs to delete
     */
    bulkDelete(objectIds: string[]): Promise<BulkDeleteResult> {
        return this.post("/internal/bulk-delete", {
            payload: { objectIds },
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
}
