import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { ContentQueryPayload, ContentQueryResult } from '@vertesia/common';

/** @deprecated Use ContentQueryPayload from @vertesia/common. */
export type QueryPayload = ContentQueryPayload;
/** @deprecated Use ContentQueryResult from @vertesia/common. */
export type QueryResult = ContentQueryResult;

/**
 * API for querying documents using SQL, ES|QL, or raw Elasticsearch DSL.
 * All queries are automatically filtered based on the authenticated user's permissions.
 */
export class QueryApi extends ApiTopic {
    constructor(parent: ClientBase, basePath: string = '/api/v1/query') {
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
    async execute(payload: ContentQueryPayload): Promise<ContentQueryResult> {
        return this.post('/', { payload });
    }

    /**
     * Execute a SQL query
     */
    async sql(query: string): Promise<ContentQueryResult> {
        return this.execute({ sql: query });
    }

    /**
     * Execute an ES|QL query
     */
    async esql(query: string): Promise<ContentQueryResult> {
        return this.execute({ esql: query });
    }

    /**
     * Execute a DSL query
     */
    async dsl(query: ContentQueryPayload['dsl']): Promise<ContentQueryResult> {
        return this.execute({ dsl: query });
    }
}
