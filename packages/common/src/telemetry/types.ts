/**
 * Agent Observability Telemetry Types
 *
 * These types define the event-based model for agent observability.
 */

/**
 * Base interface for all telemetry events
 */
export interface BaseAgentEvent {
    /** Type of the event */
    eventType: string;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Globally unique ID for this agent run */
    agentRunId: string;
    /** LLM model identifier (e.g., "claude-3-5-sonnet", "gemini-1.5-pro") */
    model: string;
    /** Environment ID (MongoDB ObjectId of the environment) */
    environmentId: string;
    /** Environment type/driver (e.g., "vertexai", "bedrock", "openai") */
    environmentType: string;
    /** Interaction ID (MongoDB ObjectId of the interaction) */
    interactionId: string;
    /** Principal ID who initiated the request (user_id for users, key ID for API keys, from onBehalfOf for agent tokens) */
    principalId: string;
    /** Principal type: user, apikey, service_account, agent */
    principalType: string;
}

// ============================================================================
// Agent Run Events
// ============================================================================

/**
 * Emitted when an agent run starts
 */
export interface AgentRunStartedEvent extends BaseAgentEvent {
    eventType: 'agent_run_started';
    /** Logical agent identifier (e.g., interaction name) */
    agentId: string;
    /** Version of the agent (e.g., workflow version) */
    agentVersion?: string;
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
export interface AgentRunCompletedEvent extends BaseAgentEvent {
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
}

// ============================================================================
// LLM Call Events
// ============================================================================

/**
 * Emitted for each LLM call (start/resume conversation)
 * Note: model, environmentId, environmentType are required (override base optional)
 */
export interface LlmCallEvent extends BaseAgentEvent {
    eventType: 'llm_call';
    /** LLM model identifier - required for LLM calls */
    model: string;
    /** Environment ID - required for LLM calls */
    environmentId: string;
    /** Environment type/driver - required for LLM calls */
    environmentType: string;
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
 * Emitted when a tool call completes (success or failure).
 * Contains all information about the tool execution including parameters and results.
 */
export interface ToolCallEvent extends BaseAgentEvent {
    eventType: 'tool_call';
    /** Name of the tool being called */
    toolName: string;
    /** Tool use ID from the LLM */
    toolUseId: string;
    /** Whether this is a built-in tool, interaction tool, or remote tool */
    toolType: 'builtin' | 'interaction' | 'remote' | 'skill';
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
 * Emitted when a checkpoint is created
 */
export interface CheckpointCreatedEvent extends BaseAgentEvent {
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
export interface IterationEvent extends BaseAgentEvent {
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

export type AgentEvent =
    | AgentRunStartedEvent
    | AgentRunCompletedEvent
    | LlmCallEvent
    | ToolCallEvent
    | CheckpointCreatedEvent
    | IterationEvent;