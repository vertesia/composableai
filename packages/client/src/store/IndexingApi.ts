import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    IndexingStatusResponse,
    GenericCommandResponse,
} from "@vertesia/common";

/**
 * API for indexing operations on content objects.
 * Provides status, reindex, and configuration management.
 */
export class IndexingApi extends ApiTopic {

    constructor(parent: ClientBase, basePath: string = "/api/v1/indexing") {
        super(parent, basePath);
    }

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
     * (routes searches to index instead of Atlas Search)
     */
    async enableQueries(): Promise<GenericCommandResponse> {
        return this.post("/enable-queries");
    }

    /**
     * Disable index-based queries for this project
     * (routes searches back to Atlas Search)
     */
    async disableQueries(): Promise<GenericCommandResponse> {
        return this.post("/disable-queries");
    }

}
