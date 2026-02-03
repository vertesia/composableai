import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";

/**
 * Query payload for agent data access
 */
export interface QueryPayload {
    /** SQL query (uses ES SQL API) */
    sql?: string;
    /** ES|QL query (Elastic's piped query language) */
    esql?: string;
    /** Raw DSL query for full control */
    dsl?: {
        query?: Record<string, unknown>;
        aggs?: Record<string, unknown>;
        size?: number;
        from?: number;
        sort?: Array<Record<string, unknown>>;
    };
    /** Output format */
    format?: 'json' | 'csv' | 'table';
}

/**
 * Query result
 */
export interface QueryResult {
    /** Result type */
    type: 'sql' | 'esql' | 'dsl';
    /** Column definitions */
    columns?: Array<{ name: string; type: string }>;
    /** Rows for SQL/ES|QL */
    rows?: unknown[][];
    /** Hits for DSL */
    hits?: Array<{ id: string; score: number; source: unknown }>;
    /** Total count */
    total?: number;
    /** Aggregations for DSL */
    aggregations?: Record<string, unknown>;
    /** Cursor for pagination (SQL) */
    cursor?: string;
    /** Query execution time in ms */
    took?: number;
}

/**
 * API for querying documents using SQL, ES|QL, or raw Elasticsearch DSL.
 * All queries are automatically filtered based on the authenticated user's permissions.
 */
export class QueryApi extends ApiTopic {

    constructor(parent: ClientBase, basePath: string = "/api/v1/query") {
        super(parent, basePath);
    }

    /**
     * Execute a query against the project's document index
     *
     * @param payload - Query payload with sql, esql, or dsl
     * @returns Query result with columns/rows or hits/aggregations
     *
     * @example SQL query
     * ```typescript
     * const result = await client.query.execute({
     *   sql: "SELECT name, status FROM content WHERE status = 'published' LIMIT 10"
     * });
     * ```
     *
     * @example ES|QL query
     * ```typescript
     * const result = await client.query.execute({
     *   esql: "FROM content | WHERE status == 'published' | STATS count = COUNT(*) BY type.name"
     * });
     * ```
     *
     * @example DSL query with aggregations
     * ```typescript
     * const result = await client.query.execute({
     *   dsl: {
     *     query: { match: { text: "machine learning" } },
     *     aggs: { by_type: { terms: { field: "type.name" } } },
     *     size: 10
     *   }
     * });
     * ```
     */
    async execute(payload: QueryPayload): Promise<QueryResult> {
        return this.post("/", { payload });
    }

    /**
     * Execute a SQL query
     */
    async sql(query: string): Promise<QueryResult> {
        return this.execute({ sql: query });
    }

    /**
     * Execute an ES|QL query
     */
    async esql(query: string): Promise<QueryResult> {
        return this.execute({ esql: query });
    }

    /**
     * Execute a DSL query
     */
    async dsl(query: QueryPayload['dsl']): Promise<QueryResult> {
        return this.execute({ dsl: query });
    }
}
