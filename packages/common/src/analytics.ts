import type { z } from 'zod';
import type {
    AnalyticsAxisSchema,
    RunAnalyticsGroupBySchema,
    RunAnalyticsQuerySchema,
    RunAnalyticsResultSchema,
    TimeResolutionSchema,
} from './api-schemas/analytics.js';

/**
 * The five run-analytics contract types, inferred from `./api-schemas/analytics.js`. Their
 * documentation moved with them — a doc comment here would be published on TOP of the schema's
 * `description` and the two would drift.
 */
export type AnalyticsAxis = z.infer<typeof AnalyticsAxisSchema>;

export type RunAnalyticsQuery = z.infer<typeof RunAnalyticsQuerySchema>;

export type RunAnalyticsGroupBy = z.infer<typeof RunAnalyticsGroupBySchema>;

export type TimeResolution = z.infer<typeof TimeResolutionSchema>;

export type RunAnalyticsResult = z.infer<typeof RunAnalyticsResultSchema>;

/** Entity with status breakdown */
export interface EntityStatusCounts {
    id: string;
    /* Optional human-readable name for the entity, if available */
    name?: string;
    /** For interactions: the published version number */
    version?: number;
    /** For interactions: the lifecycle status (draft, published, archived) */
    status?: string;
    /** Total count, or null if query failed */
    total: number | null;
    /** Counts by status, values are null if individual status query failed */
    byStatus: Record<string, number | null>;
    /** True if any query for this entity failed */
    hasErrors?: boolean;
}

/** Scalable analytics summary */
export interface RunsAnalyticsSummary {
    /** Total count of runs (from estimatedDocumentCount), null if failed */
    total: number | null;
    /** Counts by status, values are null if individual query failed */
    byStatus: Record<string, number | null>;
    /** Counts by environment with status breakdown */
    byEnvironment: EntityStatusCounts[];
    /** Counts by interaction with status breakdown */
    byInteraction: EntityStatusCounts[];
    /** Counts by code-based interaction with status breakdown */
    byCodeInteraction?: EntityStatusCounts[];
    /** Number of queries that failed out of total */
    queryStats: {
        total: number;
        failed: number;
    };
}

/** Date range filter for analytics queries */
export interface DateRangeQuery {
    /** Start date in ISO format, optional (unbounded if omitted) */
    start?: string;
    /** End date in ISO format, optional (unbounded if omitted) */
    end?: string;
}

/** Token usage for a single environment */
export interface TokenUsageByEnvironment {
    environmentId: string;
    environmentName: string;
    /** Total prompt tokens, null if query failed */
    totalPromptTokens: number | null;
}

/** Summary of token usage by environment (requires { environment: 1, created_at: -1, "token_use.prompt": 1 } index) */
export interface TokenUsageSummary {
    byEnvironment: TokenUsageByEnvironment[];
    queryStats: {
        total: number;
        failed: number;
    };
}
