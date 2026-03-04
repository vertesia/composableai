import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    CreateHiveMemoryPayload,
    FormattedMemoryForAgent,
    HiveMemory,
    HiveMemorySearchParams,
    HiveMemorySearchResult,
    UpdateHiveMemoryPayload,
} from "@vertesia/common";

/**
 * Statistics about hive memories in the project
 */
export interface HiveMemoryStats {
    total_memories: number;
    by_category: Array<{
        category: string;
        count: number;
        avg_confidence: number;
        total_usage: number;
    }>;
    overall: {
        avgConfidence: number;
        avgUsage: number;
        totalContributions: number;
    };
}

/**
 * Result from recall endpoint
 */
export interface RecallResult {
    memories: FormattedMemoryForAgent[];
    count: number;
}

/**
 * Client API for managing hive memories.
 *
 * Hive memory is a system for storing and retrieving agent learnings,
 * enabling agents to learn from past runs and share knowledge.
 */
export class HiveMemoryApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/hive-memory");
    }

    /**
     * List memories in the project.
     *
     * @param options - Optional filters and pagination
     */
    list(options?: {
        category?: string;
        scope?: string;
        limit?: number;
        offset?: number;
    }): Promise<HiveMemory[]> {
        const params = new URLSearchParams();
        if (options?.category) params.set('category', options.category);
        if (options?.scope) params.set('scope', options.scope);
        if (options?.limit) params.set('limit', String(options.limit));
        if (options?.offset) params.set('offset', String(options.offset));

        const queryString = params.toString();
        return this.get(queryString ? `/?${queryString}` : '/');
    }

    /**
     * Retrieve a memory by ID.
     */
    retrieve(id: string): Promise<HiveMemory> {
        return this.get(`/${id}`);
    }

    /**
     * Create a new hive memory.
     *
     * @param payload - Memory content including category, summary, and learnings
     */
    create(payload: CreateHiveMemoryPayload): Promise<HiveMemory> {
        return this.post("/", { payload });
    }

    /**
     * Update an existing memory with new learnings.
     *
     * This merges new learnings with existing ones rather than replacing them.
     *
     * @param id - Memory ID
     * @param payload - Fields to update/merge
     */
    update(id: string, payload: UpdateHiveMemoryPayload): Promise<HiveMemory> {
        return this.put(`/${id}`, { payload });
    }

    /**
     * Delete a memory.
     *
     * @param id - Memory ID
     */
    delete(id: string): Promise<{ id: string; deleted: boolean }> {
        return this.del(`/${id}`);
    }

    /**
     * Search memories using semantic and keyword search.
     *
     * @param params - Search parameters including query, filters, and pagination
     */
    search(params: HiveMemorySearchParams): Promise<HiveMemorySearchResult> {
        return this.post("/search", { payload: params });
    }

    /**
     * Recall memories for an agent.
     *
     * This is the primary method for agents to retrieve relevant learnings.
     * It searches for memories matching the task description and returns
     * them formatted for agent consumption.
     *
     * @param taskDescription - Description of the current task
     * @param options - Optional filters
     *
     * @example
     * ```typescript
     * const result = await client.hiveMemory.recall(
     *   "Extract financial data from PDF documents",
     *   {
     *     tools: ["extract_text", "analyze_document"],
     *     maxResults: 5
     *   }
     * );
     * ```
     */
    recall(
        taskDescription: string,
        options?: {
            tools?: string[];
            category?: string;
            maxResults?: number;
        }
    ): Promise<RecallResult> {
        return this.post("/recall", {
            payload: {
                task_description: taskDescription,
                tools: options?.tools,
                category: options?.category,
                max_results: options?.maxResults,
            }
        });
    }

    /**
     * Get a memory formatted for agent consumption.
     *
     * @param id - Memory ID
     */
    getFormatted(id: string): Promise<FormattedMemoryForAgent> {
        return this.get(`/${id}/formatted`);
    }

    /**
     * Record that a memory was used.
     *
     * This increments the usage count and helps track memory effectiveness.
     *
     * @param id - Memory ID
     */
    recordUsage(id: string): Promise<{ success: boolean }> {
        return this.post(`/${id}/usage`, {});
    }

    /**
     * Get memories by category.
     *
     * @param category - Task category (e.g., "document-analysis", "data-extraction")
     * @param options - Pagination options
     */
    getByCategory(
        category: string,
        options?: { limit?: number; offset?: number }
    ): Promise<HiveMemory[]> {
        const params = new URLSearchParams();
        if (options?.limit) params.set('limit', String(options.limit));
        if (options?.offset) params.set('offset', String(options.offset));

        const queryString = params.toString();
        return this.get(`/category/${category}${queryString ? `?${queryString}` : ''}`);
    }

    /**
     * Get memory statistics for the project.
     */
    getStats(): Promise<HiveMemoryStats> {
        return this.get("/stats");
    }

    /**
     * Apply confidence decay to unused memories.
     *
     * Admin operation that reduces confidence scores for memories
     * that haven't been used recently.
     *
     * @param options - Decay parameters
     */
    applyDecay(options?: {
        daysThreshold?: number;
        decayRate?: number;
    }): Promise<{ modified_count: number }> {
        return this.post("/admin/decay", {
            payload: {
                days_threshold: options?.daysThreshold,
                decay_rate: options?.decayRate,
            }
        });
    }

    /**
     * Archive memories with low confidence scores.
     *
     * Admin operation that removes memories below a confidence threshold.
     *
     * @param threshold - Confidence threshold (0-1), default 0.2
     */
    archiveLowConfidence(threshold?: number): Promise<{ archived_count: number }> {
        return this.post("/admin/archive", {
            payload: { threshold }
        });
    }
}
