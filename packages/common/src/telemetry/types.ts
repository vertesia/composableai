/**
 * Agent Observability Telemetry Types
 *
 * These types define the event-based telemetry model for agent observability.
 * Events are span-correlated and designed to be vendor-neutral and stable over time.
 */

/**
 * Base interface for all telemetry events
 */
export interface BaseTelemetryEvent {
    /** Type of the event */
    eventType: string;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Globally unique ID for this agent run */
    agentRunId: string;
    /** Tenant identifier (accountId:projectId) */
    tenantId: string;
    /** OpenTelemetry trace ID for correlation */
    traceId?: string;
    /** OpenTelemetry span ID for correlation */
    spanId?: string;
}

// ============================================================================
// Agent Run Events
// ============================================================================

/**
 * Emitted when an agent run starts
 */
export interface AgentRunStartedEvent extends BaseTelemetryEvent {
    eventType: 'agent_run_started';
    /** Logical agent identifier (e.g., interaction name) */
    agentId: string;
    /** Version of the agent (e.g., workflow version) */
    agentVersion?: string;
    /** Account ID */
    accountId: string;
    /** Project ID */
    projectId: string;
    /** Whether this is an interactive conversation */
    interactive: boolean;
    /** Parent run info if this is a child workflow */
    parent?: {
        runId: string;
        workflowId: string;
        depth: number;
    };
    /** Task ID if part of a multi-workstream execution */
    taskId?: string;
    /** User channel (web, email, api, etc.) */
    userChannel?: string;
}

/**
 * Emitted when an agent run completes (success or failure)
 */
export interface AgentRunCompletedEvent extends BaseTelemetryEvent {
    eventType: 'agent_run_completed';
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
    /** Estimated cost in USD */
    totalCostUsd?: number;
}

// ============================================================================
// LLM Call Events
// ============================================================================

/**
 * Emitted for each LLM call (start/resume conversation)
 */
export interface LlmCallEvent extends BaseTelemetryEvent {
    eventType: 'llm_call';
    /** LLM model identifier */
    model: string;
    /** Environment (driver) used */
    environment: string;
    /** Number of input/prompt tokens */
    promptTokens: number;
    /** Number of output/completion tokens */
    completionTokens: number;
    /** Total tokens used */
    totalTokens: number;
    /** Estimated cost in USD (if available) */
    costUsd?: number;
    /** Duration of the LLM call in milliseconds */
    durationMs: number;
    /** Whether the call succeeded */
    success: boolean;
    /** Whether streaming was enabled */
    streamingEnabled: boolean;
    /** Number of tool uses returned by the LLM */
    toolUseCount: number;
    /** Type of call: 'start' for initial, 'resume_tools' for tool results, 'resume_user' for user message */
    callType: 'start' | 'resume_tools' | 'resume_user';
    /** Activity attempt number (for retries) */
    attemptNumber?: number;
    /** Error type if failed */
    errorType?: string;
}

// ============================================================================
// Tool Call Events
// ============================================================================

/**
 * Emitted when a tool call starts
 */
export interface ToolCallStartedEvent extends BaseTelemetryEvent {
    eventType: 'tool_call_started';
    /** Name of the tool being called */
    toolName: string;
    /** Tool use ID from the LLM */
    toolUseId: string;
    /** Parameters passed to the tool (sanitized - no secrets) */
    parameters?: Record<string, unknown>;
    /** Size of parameters in bytes */
    parametersSizeBytes?: number;
    /** Whether this is a built-in tool, interaction tool, or remote tool */
    toolType: 'builtin' | 'interaction' | 'remote' | 'skill';
    /** Current iteration number */
    iteration: number;
}

/**
 * Emitted when a tool call completes
 */
export interface ToolCallCompletedEvent extends BaseTelemetryEvent {
    eventType: 'tool_call_completed';
    /** Name of the tool */
    toolName: string;
    /** Tool use ID from the LLM */
    toolUseId: string;
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
 * Emitted when a checkpoint is created
 */
export interface CheckpointCreatedEvent extends BaseTelemetryEvent {
    eventType: 'checkpoint_created';
    /** Token count that triggered the checkpoint */
    tokenCountAtCheckpoint: number;
    /** Checkpoint threshold configured */
    checkpointThreshold: number;
    /** Current iteration number */
    iteration: number;
}

// ============================================================================
// Iteration Events
// ============================================================================

/**
 * Emitted at each iteration of the agent loop
 */
export interface IterationEvent extends BaseTelemetryEvent {
    eventType: 'iteration';
    /** Current iteration number */
    iteration: number;
    /** Max iterations configured */
    maxIterations: number;
    /** Number of tools to process in this iteration */
    toolCount: number;
    /** Current token usage */
    tokenUsage?: {
        input: number;
        output: number;
        total: number;
    };
}

// ============================================================================
// Union type for all events
// ============================================================================

export type TelemetryEvent =
    | AgentRunStartedEvent
    | AgentRunCompletedEvent
    | LlmCallEvent
    | ToolCallStartedEvent
    | ToolCallCompletedEvent
    | CheckpointCreatedEvent
    | IterationEvent;

// ============================================================================
// Telemetry Context
// ============================================================================

/**
 * Context passed through async operations for telemetry correlation
 */
export interface TelemetryContext {
    /** Agent run ID */
    agentRunId: string;
    /** Tenant ID */
    tenantId: string;
    /** Account ID */
    accountId: string;
    /** Project ID */
    projectId: string;
    /** OpenTelemetry trace ID */
    traceId?: string;
    /** OpenTelemetry span ID */
    spanId?: string;
}

// ============================================================================
// Telemetry Sink Interface
// ============================================================================

/**
 * Interface for telemetry sinks that receive and process events
 */
export interface TelemetrySink {
    /** Name of the sink for logging/debugging */
    name: string;
    /** Emit a single event */
    emit(event: TelemetryEvent): void | Promise<void>;
    /** Emit multiple events (for batching) */
    emitBatch?(events: TelemetryEvent[]): void | Promise<void>;
    /** Flush any buffered events */
    flush?(): Promise<void>;
    /** Close the sink and release resources */
    close?(): Promise<void>;
}

// ============================================================================
// Telemetry Configuration
// ============================================================================

/**
 * Configuration for the telemetry system
 */
export interface TelemetryConfig {
    /** Whether telemetry is enabled */
    enabled: boolean;
    /** Sinks to emit events to */
    sinks: TelemetrySink[];
    /** Whether to include tool parameters in events (may contain sensitive data) */
    includeToolParameters?: boolean;
    /** Maximum size of tool parameters to include (bytes) */
    maxToolParametersSize?: number;
    /** Whether to sample events (1.0 = 100%, 0.1 = 10%) */
    samplingRate?: number;
}
