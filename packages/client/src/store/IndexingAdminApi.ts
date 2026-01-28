import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";

/**
 * Document data structure for Elasticsearch indexing
 */
export interface ElasticsearchDocumentData {
    name?: string;
    text?: string;
    properties?: Record<string, unknown>;
    status?: string;
    type?: {
        id?: string;
        name?: string;
    };
    security?: {
        'content:read'?: string[];
        'content:write'?: string[];
        'content:delete'?: string[];
    };
    revision?: {
        head?: boolean;
        root?: string;
    };
    embeddings_text?: number[];
    embeddings_image?: number[];
    embeddings_properties?: number[];
    created_at?: Date | string;
    updated_at?: Date | string;
}

/**
 * Result from bulk indexing
 */
export interface BulkIndexResult {
    successful: number;
    failed: number;
}

/**
 * Result from creating a reindex target
 */
export interface CreateReindexTargetResult {
    created: boolean;
    indexName: string;
    aliasName: string;
    version: number;
}

/**
 * Result from getting reindex range
 */
export interface ReindexRangeResult {
    first: string | null;
    last: string | null;
    count: number;
}

/**
 * Result from fetching a batch
 */
export interface FetchBatchResult {
    documents: Array<{
        id: string;
        document: ElasticsearchDocumentData;
    }>;
    nextCursor: string | null;
    done: boolean;
}

/**
 * Result from indexing a batch
 */
export interface IndexBatchResult {
    successful: number;
    failed: number;
    processed: number;
    nextCursor: string | null;
    done: boolean;
}

/**
 * Result from triggering a reindex
 */
export interface TriggerReindexResult {
    status: string;
    workflow?: string;
    workflowId?: string;
    runId?: string;
    objectCount?: number;
    reason?: string;
    enabled?: boolean;
}

/**
 * Elasticsearch index statistics
 */
export interface ElasticsearchIndexStats {
    enabled: boolean;
    exists?: boolean;
    documentCount?: number;
    sizeInBytes?: number;
    indexName?: string;
    aliasName?: string;
}

/**
 * Result from fetching documents by IDs
 */
export interface FetchDocumentsByIdsResult {
    documents: Array<{
        id: string;
        document: ElasticsearchDocumentData;
    }>;
    notFound: string[];
}

/**
 * Result from bulk delete
 */
export interface BulkDeleteResult {
    successful: number;
    failed: number;
}

/**
 * Admin API for Elasticsearch operations
 *
 * These methods are called by Temporal workflow activities to perform
 * Elasticsearch operations. They require content admin permissions.
 */
export class IndexingAdminApi extends ApiTopic {

    constructor(parent: ClientBase, basePath: string = "/admin/elasticsearch") {
        super(parent, basePath);
    }

    /**
     * Index a single document to Elasticsearch
     */
    index(objectId: string, document: ElasticsearchDocumentData): Promise<{ status: string; objectId: string }> {
        return this.post("/index", {
            payload: { objectId, document },
        });
    }

    /**
     * Delete a document from Elasticsearch
     */
    delete(objectId: string): Promise<{ status: string; objectId: string }> {
        return this.post("/delete", {
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
        return this.post("/bulk-index", {
            payload: { documents, targetIndex },
        });
    }

    /**
     * Ensure Elasticsearch index exists for the project
     *
     * @param recreate If true, drops and recreates the index
     */
    ensureIndex(recreate?: boolean): Promise<{ created: boolean; recreated?: boolean; existed?: boolean }> {
        return this.post("/ensure-index", {
            payload: { recreate },
        });
    }

    /**
     * Create a new versioned index for reindexing (without alias)
     * The alias will be swapped after reindexing completes via swapAlias
     */
    createReindexTarget(): Promise<CreateReindexTargetResult> {
        return this.post("/create-reindex-target", {
            payload: {},
        });
    }

    /**
     * Atomically swap the alias from old index to new index
     *
     * @param newIndexName The new index to point the alias to
     * @param deleteOld If true, deletes the old index after swapping
     */
    swapAlias(newIndexName: string, deleteOld?: boolean): Promise<{ swapped: boolean; aliasName?: string; newIndexName?: string }> {
        return this.post("/swap-alias", {
            payload: { newIndexName, deleteOld },
        });
    }

    /**
     * Get Elasticsearch index statistics for the project
     */
    getStats(): Promise<ElasticsearchIndexStats> {
        return this.post("/stats", {
            payload: {},
        });
    }

    /**
     * Get the _id range for reindexing (first, last, count)
     * Used by workflow to set up cursor-based pagination
     */
    getReindexRange(): Promise<ReindexRangeResult> {
        return this.post("/reindex-range", {
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
        return this.post("/fetch-batch", {
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
     */
    indexBatch(cursor?: string | null, limit?: number, targetIndex?: string): Promise<IndexBatchResult> {
        return this.post("/index-batch", {
            payload: { cursor, limit, targetIndex },
        });
    }

    /**
     * Trigger a reindex operation via Temporal workflow
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
        return this.post("/reindex", {
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
        return this.post("/fetch-by-ids", {
            payload: { objectIds },
        });
    }

    /**
     * Bulk delete documents from Elasticsearch
     *
     * @param objectIds Array of object IDs to delete
     */
    bulkDelete(objectIds: string[]): Promise<BulkDeleteResult> {
        return this.post("/bulk-delete", {
            payload: { objectIds },
        });
    }
}
