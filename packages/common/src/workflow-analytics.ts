/**
 * Workflow Analytics Types
 *
 * Types for querying and presenting workflow telemetry analytics.
 * Designed for end-user facing dashboards with aggregated metrics.
 */

// ============================================================================
// Query Types
// ============================================================================

/**
 * Time resolution for analytics aggregation
 */
export type WorkflowAnalyticsResolution = 'hour' | 'day' | 'week' | 'month';

/**
 * Dimensions to group analytics by
 */
export type WorkflowAnalyticsGroupBy =
    | 'model'           // Group by LLM model (claude-3-5-sonnet, gemini-1.5-pro, etc.)
    | 'environment'     // Group by environment/driver (vertexai, bedrock, openai)
    | 'tool'            // Group by tool name
    | 'toolType'        // Group by tool type (builtin, interaction, remote, skill)
    | 'agent'           // Group by agent/interaction name
    | 'errorType';      // Group by error type

/**
 * Filter criteria for workflow analytics queries
 */
export interface WorkflowAnalyticsFilter {
    /** Filter by specific agent/interaction names */
    agents?: string[];
    /** Filter by LLM models */
    models?: string[];
    /** Filter by environments/drivers */
    environments?: string[];
    /** Filter by tool names */
    tools?: string[];
    /** Filter by tool types */
    toolTypes?: ('builtin' | 'interaction' | 'remote' | 'skill')[];
    /** Filter by success/failure status */
    success?: boolean;
    /** Filter by specific workflow run IDs */
    runIds?: string[];
}

/**
 * Base query parameters for all workflow analytics endpoints
 */
export interface WorkflowAnalyticsQueryBase {
    /** Start time (ISO 8601 or Unix timestamp) */
    from?: string | number;
    /** End time (ISO 8601 or Unix timestamp) */
    to?: string | number;
    /** Filters to apply */
    filter?: WorkflowAnalyticsFilter;
}

/**
 * Query for time-series analytics (metrics over time)
 */
export interface WorkflowAnalyticsTimeSeriesQuery extends WorkflowAnalyticsQueryBase {
    /** Time bucket resolution */
    resolution?: WorkflowAnalyticsResolution;
    /** Optional grouping dimension */
    groupBy?: WorkflowAnalyticsGroupBy;
}

/**
 * Query for summary/aggregate analytics
 */
export interface WorkflowAnalyticsSummaryQuery extends WorkflowAnalyticsQueryBase {
    /** Dimension to group results by */
    groupBy?: WorkflowAnalyticsGroupBy;
    /** Maximum number of groups to return (for top-N queries) */
    limit?: number;
}

/**
 * Query for tool parameter analytics
 */
export interface WorkflowToolParametersQuery extends WorkflowAnalyticsQueryBase {
    /** Specific tool to analyze parameters for (required) */
    toolName: string;
    /** Maximum number of parameter patterns to return */
    limit?: number;
}

// ============================================================================
// Result Types - Token Usage
// ============================================================================

/**
 * Token usage metrics
 */
export interface TokenUsageMetrics {
    /** Total input/prompt tokens */
    inputTokens: number;
    /** Total output/completion tokens */
    outputTokens: number;
    /** Total tokens (input + output) */
    totalTokens: number;
    /** Average tokens per LLM call */
    avgTokensPerCall?: number;
}

/**
 * Token usage aggregated by dimension
 */
export interface TokenUsageByDimension {
    /** The dimension value (model name, tool name, etc.) */
    dimension: string;
    /** Token usage metrics */
    usage: TokenUsageMetrics;
    /** Number of LLM calls */
    callCount: number;
    /** Percentage of total tokens */
    percentageOfTotal?: number;
}

/**
 * Token usage time series data point
 */
export interface TokenUsageTimeSeriesPoint {
    /** Timestamp bucket (ISO 8601) */
    timestamp: string;
    /** Token usage metrics for this bucket */
    usage: TokenUsageMetrics;
    /** Number of LLM calls in this bucket */
    callCount: number;
    /** Optional group value if groupBy was specified */
    group?: string;
}

// ============================================================================
// Result Types - Latency/Duration
// ============================================================================

/**
 * Duration/latency statistics
 */
export interface DurationStats {
    /** Average duration in milliseconds */
    avgMs: number;
    /** Minimum duration in milliseconds */
    minMs: number;
    /** Maximum duration in milliseconds */
    maxMs: number;
    /** Median duration in milliseconds (p50) */
    medianMs?: number;
    /** 95th percentile duration in milliseconds */
    p95Ms?: number;
    /** 99th percentile duration in milliseconds */
    p99Ms?: number;
}

/**
 * Latency metrics for a specific dimension
 */
export interface LatencyByDimension {
    /** The dimension value (model name, tool name, agent name, etc.) */
    dimension: string;
    /** Duration statistics */
    duration: DurationStats;
    /** Number of executions */
    count: number;
    /** Success rate (0-1) */
    successRate: number;
}

/**
 * Latency time series data point
 */
export interface LatencyTimeSeriesPoint {
    /** Timestamp bucket (ISO 8601) */
    timestamp: string;
    /** Duration statistics for this bucket */
    duration: DurationStats;
    /** Number of executions in this bucket */
    count: number;
    /** Success rate in this bucket (0-1) */
    successRate: number;
    /** Optional group value if groupBy was specified */
    group?: string;
}

// ============================================================================
// Result Types - Error Analytics
// ============================================================================

/**
 * Error rate metrics
 */
export interface ErrorMetrics {
    /** Total number of executions */
    totalCount: number;
    /** Number of successful executions */
    successCount: number;
    /** Number of failed executions */
    errorCount: number;
    /** Error rate (0-1) */
    errorRate: number;
}

/**
 * Error breakdown by type
 */
export interface ErrorByType {
    /** Error type (e.g., "timeout", "rate_limit", "invalid_response") */
    errorType: string;
    /** Number of occurrences */
    count: number;
    /** Percentage of total errors */
    percentageOfErrors: number;
    /** Example error message (truncated) */
    exampleMessage?: string;
}

/**
 * Error analytics by dimension
 */
export interface ErrorByDimension {
    /** The dimension value (model name, tool name, etc.) */
    dimension: string;
    /** Error metrics */
    metrics: ErrorMetrics;
    /** Breakdown by error type */
    errorTypes?: ErrorByType[];
}

/**
 * Error time series data point
 */
export interface ErrorTimeSeriesPoint {
    /** Timestamp bucket (ISO 8601) */
    timestamp: string;
    /** Error metrics for this bucket */
    metrics: ErrorMetrics;
    /** Optional group value if groupBy was specified */
    group?: string;
}

// ============================================================================
// Result Types - Tool Analytics
// ============================================================================

/**
 * Tool usage metrics
 */
export interface ToolUsageMetrics {
    /** Tool name */
    toolName: string;
    /** Tool type */
    toolType: 'builtin' | 'interaction' | 'remote' | 'skill';
    /** Number of invocations */
    invocationCount: number;
    /** Success rate (0-1) */
    successRate: number;
    /** Duration statistics */
    duration: DurationStats;
    /** Average input size in bytes */
    avgInputSizeBytes?: number;
    /** Average output size in bytes */
    avgOutputSizeBytes?: number;
}

/**
 * Parameter value distribution for a tool
 */
export interface ToolParameterValue {
    /** Parameter name */
    parameterName: string;
    /** Parameter value (stringified) */
    value: string;
    /** Number of times this value was used */
    count: number;
    /** Percentage of total invocations */
    percentage: number;
}

/**
 * Tool parameter analytics
 */
export interface ToolParameterAnalytics {
    /** Tool name */
    toolName: string;
    /** Total invocations analyzed */
    totalInvocations: number;
    /** Parameter value distributions */
    parameters: {
        [parameterName: string]: {
            /** Top values for this parameter */
            topValues: ToolParameterValue[];
            /** Number of unique values */
            uniqueValueCount: number;
        };
    };
}

// ============================================================================
// Result Types - Summary/Overview
// ============================================================================

/**
 * Overall workflow analytics summary
 */
export interface WorkflowAnalyticsSummary {
    /** Time range of the data */
    timeRange: {
        from: string;
        to: string;
    };
    /** Total workflow runs */
    totalRuns: number;
    /** Successful runs */
    successfulRuns: number;
    /** Failed runs */
    failedRuns: number;
    /** Overall success rate (0-1) */
    successRate: number;
    /** Total token usage */
    tokenUsage: TokenUsageMetrics;
    /** Average run duration */
    avgRunDurationMs: number;
    /** Total LLM calls */
    totalLlmCalls: number;
    /** Total tool calls */
    totalToolCalls: number;
    /** Unique models used */
    uniqueModels: string[];
    /** Unique tools used */
    uniqueTools: string[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response for token usage analytics
 */
export interface TokenUsageAnalyticsResponse {
    /** Summary metrics */
    summary: TokenUsageMetrics;
    /** Breakdown by requested dimension */
    byDimension?: TokenUsageByDimension[];
    /** Time series data if resolution was specified */
    timeSeries?: TokenUsageTimeSeriesPoint[];
}

/**
 * Response for latency analytics
 */
export interface LatencyAnalyticsResponse {
    /** Summary metrics */
    summary: DurationStats & { count: number; successRate: number };
    /** Breakdown by requested dimension */
    byDimension?: LatencyByDimension[];
    /** Time series data if resolution was specified */
    timeSeries?: LatencyTimeSeriesPoint[];
}

/**
 * Response for error analytics
 */
export interface ErrorAnalyticsResponse {
    /** Summary metrics */
    summary: ErrorMetrics;
    /** Breakdown by error type */
    byErrorType?: ErrorByType[];
    /** Breakdown by requested dimension */
    byDimension?: ErrorByDimension[];
    /** Time series data if resolution was specified */
    timeSeries?: ErrorTimeSeriesPoint[];
}

/**
 * Response for tool analytics
 */
export interface ToolAnalyticsResponse {
    /** Tool usage metrics */
    tools: ToolUsageMetrics[];
    /** Total tool invocations */
    totalInvocations: number;
}

/**
 * Response for tool parameter analytics
 */
export interface ToolParameterAnalyticsResponse {
    /** Tool parameter analytics */
    analytics: ToolParameterAnalytics;
}

/**
 * Response for overall summary analytics
 */
export interface WorkflowAnalyticsSummaryResponse {
    /** Summary data */
    summary: WorkflowAnalyticsSummary;
}
