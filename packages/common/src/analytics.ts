
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

    /** The time resolution of the analytics query */
    resolution?: TimeResolution;

    /** The field to sort by */
    virtual?: boolean;

}


export type RunAnalyticsGroupBy = "interaction" | "modelId" | "project" | "status" | "tags" | "environment";

export type TimeResolution = "hour" | "day" | "week" | "month" | "year";


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
    total: number;
    byStatus: Record<string, number>;
}

/** Lightweight analytics summary using covered queries - scalable to 1M+ documents */
export interface RunsAnalyticsSummary {
    /** Total count of runs (from estimatedDocumentCount) */
    total: number;
    /** Counts by status: { completed: 1000, failed: 50, ... } */
    byStatus: Record<string, number>;
    /** Counts by environment with status breakdown (uses { environment: 1, status: 1 } compound index) */
    byEnvironment: EntityStatusCounts[];
    /** Counts by interaction with status breakdown (uses { interaction: 1, status: 1 } compound index) */
    byInteraction: EntityStatusCounts[];
}
