
export interface AnalyticsAxis {
    environment?: string;
    project?: string;
    interactions?: string[];
    models?: string[];
    status?: string[];
    tags?: string[];
    selectedOnly?: boolean;
}

export interface RunAnalyticsQuery {

    /** filters to apply to the query */
    filterBy: AnalyticsAxis;

    /** The field to group by */
    groupBy?: RunAnalyticsGroupBy

    /** The start date of the query in EPOCH format */
    from?: number;
    /** The end date of the query in EPOCH format */
    to?: number;

    /** The time resolution unit of the analytics query */
    resolution?: TimeResolution;

    /** The step size for the resolution (e.g., 4 with resolution='hour' means 4-hour intervals). Defaults to 1. */
    resolutionStep?: number;

    /** The field to sort by */
    virtual?: boolean;

}


export type RunAnalyticsGroupBy = "interaction" | "modelId" | "project" | "status" | "tags" | "environment";

export type TimeResolution = "minute" | "hour" | "day" | "week" | "month" | "year";


export interface RunAnalyticsResult {
    date: string,
    timestamp: string,
    group: string
    count: number,
    execution_time: {
        avg: number,
        min: number,
        max: number
    },
}

/** Entity with status breakdown (requires compound index for covered queries) */
export interface EntityStatusCounts {
    id: string;
    name: string;
    /** Total count, or null if query failed */
    total: number | null;
    /** Counts by status, values are null if individual status query failed */
    byStatus: Record<string, number | null>;
    /** True if any query for this entity failed */
    hasErrors?: boolean;
}

/** Lightweight analytics summary using covered queries - scalable to 1M+ documents */
export interface RunsAnalyticsSummary {
    /** Total count of runs (from estimatedDocumentCount), null if failed */
    total: number | null;
    /** Counts by status, values are null if individual query failed */
    byStatus: Record<string, number | null>;
    /** Counts by environment with status breakdown (uses { environment: 1, status: 1 } compound index) */
    byEnvironment: EntityStatusCounts[];
    /** Counts by interaction with status breakdown (uses { interaction: 1, status: 1 } compound index) */
    byInteraction: EntityStatusCounts[];
    /** Number of queries that failed out of total */
    queryStats: {
        total: number;
        failed: number;
    };
}

/** Date range filter for analytics queries (uses created_at field) */
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
