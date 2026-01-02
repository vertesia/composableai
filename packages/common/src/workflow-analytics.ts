/**
 * Agent Observability Telemetry Types
 *
 * These types define the event-based model for agent observability.
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Types of telemetry events
 */
export enum AgentEventType {
    AgentRunStarted = 'agent_run_started',
    AgentRunCompleted = 'agent_run_completed',
    LlmCall = 'llm_call',
    ToolCall = 'tool_call'
}

/**
 * Types of LLM calls in a conversation
 */
export enum LlmCallType {
    /** Initial conversation start */
    Start = 'start',
    /** Resuming with tool results */
    ResumeTools = 'resume_tools',
    /** Resuming with user message */
    ResumeUser = 'resume_user',
    /** Checkpoint resume (after conversation summarization) */
    Checkpoint = 'checkpoint',
    /** Nested interaction call from within tools */
    NestedInteraction = 'nested_interaction',

}

/**
 * Types of tools that can be called
 */
export enum TelemetryToolType {
    /** Built-in tools (e.g., plan, search) */
    Builtin = 'builtin',
    /** Interaction-based tools */
    Interaction = 'interaction',
    /** Remote/MCP tools */
    Remote = 'remote',
    /** Skill tools */
    Skill = 'skill',
}

// ============================================================================
// Base Event
// ============================================================================

/**
 * Base interface for all telemetry events
 */
export interface BaseAgentEvent {
    /** Type of the event */
    eventType: string;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Globally unique ID for this agent run */
    runId: string;
    /** LLM model identifier (e.g., "claude-3-5-sonnet", "gemini-1.5-pro") */
    model: string;
    /** Environment ID (MongoDB ObjectId of the environment) */
    environmentId: string;
    /** Environment type/driver (e.g., "vertexai", "bedrock", "openai") */
    environmentType: string;
    /** Interaction ID (MongoDB ObjectId of the interaction) */
    interactionId: string;
    /** Immediate parent run ID (if this is a child workflow) */
    parentRunId?: string;
    /** Ancestor run IDs from root to immediate parent (for hierarchical aggregation) */
    ancestorRunIds?: string[];
}

// ============================================================================
// Agent Run Events
// ============================================================================

/**
 * Emitted when an agent run starts
 */
export interface AgentRunStartedEvent extends BaseAgentEvent {
    eventType: AgentEventType.AgentRunStarted;
    /** Whether this is an interactive conversation */
    interactive: boolean;
    /** Task ID if part of a multi-workstream execution */
    taskId?: string;
    /** User channels enabled for this run (email, interactive, etc.) */
    userChannels?: string[];
}

/**
 * Emitted when an agent run completes (success or failure)
 */
export interface AgentRunCompletedEvent extends BaseAgentEvent {
    eventType: AgentEventType.AgentRunCompleted;
    /** Whether the run succeeded */
    success: boolean;
    /** Total duration in milliseconds */
    durationMs: number;
    /** Error type if failed */
    errorType?: string;
    /** Error message if failed */
    errorMessage?: string;
    /** Total iterations in the conversation loop */
    totalIterations: number;
    /** Total tool calls made */
    totalToolCalls: number;
    /** Total LLM calls made */
    totalLlmCalls: number;
    /** Cumulative token usage */
    totalTokens?: {
        input: number;
        output: number;
        total: number;
    };
    /** If conversation was ended via end_conversation tool */
    endConversation?: {
        /** Status provided by the agent */
        status: 'success' | 'failure';
        /** Reason provided by the agent (especially for failures) */
        reason?: string;
    };
}

// ============================================================================
// LLM Call Events
// ============================================================================

/**
 * Emitted for each LLM call (start/resume conversation)
 * Note: model, environmentId, environmentType are required (override base optional)
 */
export interface LlmCallEvent extends BaseAgentEvent {
    eventType: AgentEventType.LlmCall;
    /** Number of input/prompt tokens */
    promptTokens: number;
    /** Number of output/completion tokens */
    completionTokens: number;
    /** Total tokens used */
    totalTokens: number;
    /** Duration of the LLM call in milliseconds */
    durationMs: number;
    /** Whether the call succeeded */
    success: boolean;
    /** Whether streaming was enabled */
    streamingEnabled: boolean;
    /** Number of tool uses returned by the LLM */
    toolUseCount: number;
    /** Type of call: 'start' for initial, 'resume_tools' for tool results, 'resume_user' for user message */
    callType: LlmCallType;
    /** Activity attempt number (for retries) */
    attemptNumber?: number;
    /** Error type if failed */
    errorType?: string;
}

// ============================================================================
// Tool Call Events
// ============================================================================

/**
 * Emitted when a tool call completes (success or failure).
 * Contains all information about the tool execution including parameters and results.
 */
export interface ToolCallEvent extends BaseAgentEvent {
    eventType: AgentEventType.ToolCall;
    /** Name of the tool being called */
    toolName: string;
    /** Tool use ID from the LLM */
    toolUseId: string;
    /** Whether this is a built-in tool, interaction tool, or remote tool */
    toolType: TelemetryToolType;
    /** Current iteration number */
    iteration: number;
    /** Parameters passed to the tool (sanitized - no secrets) */
    parameters?: Record<string, unknown>;
    /** Size of parameters in bytes */
    parametersSizeBytes?: number;
    /** Whether the tool call succeeded */
    success: boolean;
    /** Duration in milliseconds */
    durationMs: number;
    /** Size of result in bytes */
    resultSizeBytes?: number;
    /** Error type if failed */
    errorType?: string;
    /** Error message if failed (truncated) */
    errorMessage?: string;
    /** Whether this tool spawned a child workflow */
    spawnedChildWorkflow?: boolean;
}

// ============================================================================
// Checkpoint Events
// ============================================================================

/**
 * Emitted when a checkpoint is created.
 * Extends LlmCallEvent since checkpoint creation involves an LLM call.
 */
export interface CheckpointCreatedEvent extends LlmCallEvent {
    callType: LlmCallType.Checkpoint;
    /** Token count that triggered the checkpoint (before this LLM call) */
    tokenCountAtCheckpoint: number;
    /** Checkpoint threshold configured */
    checkpointThreshold: number;
    /** Current iteration number */
    iteration: number;
}

// ============================================================================
// Nested Interaction Execution Events
// ============================================================================

/**
 * Emitted when a nested interaction is called from within a tool.
 * Extends LlmCallEvent since nested interaction execution involves an LLM call.
 */
export interface NestedInteractionEvent extends LlmCallEvent {
    callType: LlmCallType.NestedInteraction;
    /** The interaction being called (e.g., "sys:AnalyzeDocument") */
    nestedInteractionId: string;
    /** Tool that triggered this call - same pattern as ToolCallEvent */
    toolName: string;
    /** Tool type - same pattern as ToolCallEvent */
    toolType: TelemetryToolType;
}


// ============================================================================
// Union type for all events
// ============================================================================

export type AgentEvent =
    | AgentRunStartedEvent
    | AgentRunCompletedEvent
    | LlmCallEvent
    | ToolCallEvent
    | CheckpointCreatedEvent
    | NestedInteractionEvent;   

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
export type WorkflowAnalyticsResolution = 'minute' | 'hour' | 'day' | 'week' | 'month';

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
    /** Filter by principal IDs (users or API keys) */
    principals?: string[];
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
    /** Resolution step size (e.g., 2 means 2-hour buckets when resolution is 'hour'). Defaults to 1. */
    resolutionStep?: number;
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
    /** Timestamp bucket start (ISO 8601) */
    timestamp: string;
    /** Timestamp bucket end (ISO 8601) */
    timestampEnd: string;
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
    /** Timestamp bucket start (ISO 8601) */
    timestamp: string;
    /** Timestamp bucket end (ISO 8601) */
    timestampEnd: string;
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
    /** Number of LLM call errors */
    llmErrorCount?: number;
    /** Number of tool call errors */
    toolErrorCount?: number;
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
    /** Timestamp bucket start (ISO 8601) */
    timestamp: string;
    /** Timestamp bucket end (ISO 8601) */
    timestampEnd: string;
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
    /** Ongoing runs (started but not yet completed) */
    ongoingRuns: number;
    /** Overall success rate (0-1) */
    successRate: number;
    /** Total token usage */
    tokenUsage: TokenUsageMetrics;
    /** Token usage from nested interaction calls (e.g., sys:AnalyzeDocument) */
    nestedInteractionTokens: TokenUsageMetrics;
    /** Average run duration (non-interactive runs only) */
    avgRunDurationMs: number;
    /** 95th percentile run duration (non-interactive runs only) */
    p95RunDurationMs: number;
    /** Number of non-interactive runs used for duration calculation */
    nonInteractiveRunCount: number;
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

/**
 * Agent/interaction reference with id and display name
 */
export interface AgentFilterOption {
    /** The agent/interaction ID (used for filtering) */
    id: string;
    /** The display name (resolved from interaction) */
    name: string;
}

/**
 * Environment reference with id and display name
 */
export interface EnvironmentFilterOption {
    /** The environment ID (used for filtering) */
    id: string;
    /** The display name (resolved from environment) */
    name: string;
}

/**
 * Environment-model pair from telemetry data
 */
export interface EnvironmentModelPair {
    /** Environment ID */
    environmentId: string;
    /** Environment display name */
    environmentName: string;
    /** Model ID (used for filtering) */
    modelId: string;
    /** Model display name (human-readable) */
    modelName: string;
}

/**
 * Principal (user/API key) filter option
 */
export interface PrincipalFilterOption {
    /** The principal ID (user ID or API key ID) */
    id: string;
    /** The principal type (user, apikey, service_account, agent) */
    type: string;
    /** The display name (user email/name, API key name, etc.) */
    name: string;
}

/**
 * Response for available filter options (unique values from telemetry data)
 */
export interface WorkflowAnalyticsFilterOptionsResponse {
    /** Unique agent/interaction options with id and name */
    agents: AgentFilterOption[];
    /** Environment-model pairs (since models are environment-specific) */
    environmentModels: EnvironmentModelPair[];
    /** Unique principals (users and API keys) that have triggered agent runs */
    principals: PrincipalFilterOption[];
}

// ============================================================================
// Prompt Size Analytics
// ============================================================================

/**
 * Prompt size metrics for a single agent
 */
export interface PromptSizeByAgent {
    /** Agent ID (to be resolved to name by the API) */
    agentId: string;
    /** Agent display name (resolved from interaction) */
    agentName: string;
    /** Average prompt/input tokens for start calls */
    avgPromptTokens: number;
    /** Number of start calls */
    startCallCount: number;
}

/**
 * Response for prompt size analytics by agent
 */
export interface PromptSizeAnalyticsResponse {
    /** Prompt size metrics by agent */
    byAgent: PromptSizeByAgent[];
}

// ============================================================================
// Top Principals Analytics
// ============================================================================

/**
 * Top principal (user/API key/service account) metrics
 */
export interface TopPrincipal {
    /** Principal ID (user ID, API key ID, etc.) */
    principalId: string;
    /** Principal type (user, apikey, service_account, agent) */
    principalType: string;
    /** Display name (user email/name, API key name, etc.) */
    displayName: string;
    /** Number of agent runs started by this principal */
    runCount: number;
}

/**
 * Response for top principals analytics (most active users/principals)
 */
export interface TopPrincipalsAnalyticsResponse {
    /** List of top principals sorted by run count descending */
    principals: TopPrincipal[];
    /** Total number of runs in the period */
    totalRuns: number;
}

// ============================================================================
// Runs by Agent Analytics
// ============================================================================

/**
 * Agent run distribution metrics
 */
export interface AgentRunDistribution {
    /** Agent/interaction ID */
    agentId: string;
    /** Agent display name (resolved from interaction) */
    agentName: string;
    /** Number of runs for this agent */
    runCount: number;
    /** Percentage of total runs */
    percentage: number;
}

/**
 * Response for runs by agent analytics
 */
export interface RunsByAgentAnalyticsResponse {
    /** List of agents sorted by run count descending */
    agents: AgentRunDistribution[];
    /** Total number of runs in the period */
    totalRuns: number;
}

// ============================================================================
// Time to First Response Analytics
// ============================================================================

/**
 * Time to first response metrics
 * Measures the time from agent run start to the completion of the first LLM call
 */
export interface TimeToFirstResponseMetrics {
    /** Average time to first response in milliseconds */
    avgMs: number;
    /** Minimum time to first response in milliseconds */
    minMs: number;
    /** Maximum time to first response in milliseconds */
    maxMs: number;
    /** Median time to first response in milliseconds (p50) */
    medianMs: number;
    /** 95th percentile time to first response in milliseconds */
    p95Ms: number;
    /** 99th percentile time to first response in milliseconds */
    p99Ms: number;
    /** Number of agent runs analyzed */
    runCount: number;
}

/**
 * Time to first response time series data point
 */
export interface TimeToFirstResponseTimeSeriesPoint {
    /** Timestamp bucket start (ISO 8601) */
    timestamp: string;
    /** Timestamp bucket end (ISO 8601) */
    timestampEnd: string;
    /** Average time to first response in this bucket (ms) */
    avgMs: number;
    /** Number of runs in this bucket */
    count: number;
}

/**
 * Response for time to first response analytics
 */
export interface TimeToFirstResponseAnalyticsResponse {
    /** Summary metrics */
    summary: TimeToFirstResponseMetrics;
    /** Time series data if resolution was specified */
    timeSeries?: TimeToFirstResponseTimeSeriesPoint[];
}

// ============================================================================
// First Response Behavior Analytics
// ============================================================================

/**
 * First response behavior metrics
 * Analyzes the agent's first LLM response (callType = 'start') behavior
 */
export interface FirstResponseBehaviorMetrics {
    /** Total number of agent runs analyzed */
    totalRuns: number;
    /** Number of runs where the first response used a plan tool */
    runsWithPlanTool: number;
    /** Percentage of runs that start with a plan tool (0-100) */
    planToolPercentage: number;
    /** Number of runs where the first response had no tool calls */
    runsWithNoTools: number;
    /** Percentage of runs that start with no tool calls (0-100) */
    noToolsPercentage: number;
    /** Number of runs where the first response had tool calls (excluding plan only) */
    runsWithOtherTools: number;
    /** Percentage of runs that start with other tool calls (0-100) */
    otherToolsPercentage: number;
}

/**
 * First response behavior time series data point
 */
export interface FirstResponseBehaviorTimeSeriesPoint {
    /** Timestamp bucket start (ISO 8601) */
    timestamp: string;
    /** Timestamp bucket end (ISO 8601) */
    timestampEnd: string;
    /** Total runs in this bucket */
    totalRuns: number;
    /** Runs with plan tool in this bucket */
    runsWithPlanTool: number;
    /** Runs with no tools in this bucket */
    runsWithNoTools: number;
}

/**
 * Response for first response behavior analytics
 */
export interface FirstResponseBehaviorAnalyticsResponse {
    /** Summary metrics */
    summary: FirstResponseBehaviorMetrics;
    /** Time series data if resolution was specified */
    timeSeries?: FirstResponseBehaviorTimeSeriesPoint[];
}
