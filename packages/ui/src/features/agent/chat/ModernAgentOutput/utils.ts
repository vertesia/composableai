import dayjs from "dayjs";
import { AgentMessage, AgentMessageType, WorkflowRunEvent } from "@vertesia/common";
import { VertesiaClient } from "@vertesia/client";

export function insertMessageInTimeline(arr: AgentMessage[], m: AgentMessage) {
    const t = typeof m.timestamp === "number" ? m.timestamp : new Date(m.timestamp).getTime();
    const idx = arr.findIndex((a) => {
        const at = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
        return at > t;
    });
    if (idx === -1) arr.push(m);
    else arr.splice(idx, 0, m);
}

/**
 * Check if a conversation is still in progress
 * This function checks the main workstream status to determine if the conversation is complete
 * For multi-workstream scenarios, we keep streaming until the main workstream is complete
 */

export const DONE_STATES = [
    AgentMessageType.COMPLETE,
    AgentMessageType.IDLE,
    AgentMessageType.REQUEST_INPUT,
    AgentMessageType.TERMINATED,
];

export function isInProgress(messages: AgentMessage[]) {
    if (!messages.length) return true;

    // First, group messages by workstream
    const workstreamMessages = new Map<string, AgentMessage[]>();

    messages.forEach((message) => {
        const workstreamId = getWorkstreamId(message);
        if (!workstreamMessages.has(workstreamId)) {
            workstreamMessages.set(workstreamId, []);
        }
        workstreamMessages.get(workstreamId)!.push(message);
    });

    // Log all workstreams we found for debugging
    console.log("[isInProgress] Workstreams found:", Array.from(workstreamMessages.keys()));

    // If there's only one workstream and it's not "main", we should treat it as the main one
    // This handles cases where a conversation might not have an explicit main workstream
    if (workstreamMessages.size === 1 && !workstreamMessages.has("main")) {
        const onlyWorkstreamId = workstreamMessages.keys().next().value || "unknown";
        console.log(`[isInProgress] Only one workstream found (${onlyWorkstreamId}), treating as main`);

        const onlyWorkstreamMsgs = workstreamMessages.get(onlyWorkstreamId)!;
        const lastMessage = onlyWorkstreamMsgs[onlyWorkstreamMsgs.length - 1];

        console.log(`[isInProgress] Last message type in only workstream: ${lastMessage.type}`);

        // Check if this single workstream is completed
        if (!DONE_STATES.includes(
            lastMessage.type
        )) {
            console.log("[isInProgress] Only workstream is still in progress");
            return true;
        }

        console.log("[isInProgress] Only workstream is completed");
        return false;
    }

    // Check the main workstream if it exists
    if (workstreamMessages.has("main")) {
        const mainWorkstreamMsgs = workstreamMessages.get("main")!;

        // If there are no messages in the main workstream, the conversation is still in progress
        if (mainWorkstreamMsgs.length === 0) {
            console.log("[isInProgress] Main workstream exists but has no messages, still in progress");
            return true;
        }

        // Check if the main workstream is completed
        const lastMainMessage = mainWorkstreamMsgs[mainWorkstreamMsgs.length - 1];
        console.log(`[isInProgress] Last message type in main workstream: ${lastMainMessage.type}`);

        if (!DONE_STATES.includes(
            lastMainMessage.type
        )) {
            console.log("[isInProgress] Main workstream is still in progress");
            return true;
        }

        console.log("[isInProgress] Main workstream is completed");
        return false;
    }

    // If we get here, there are multiple workstreams but no "main" workstream
    // We'll keep the conversation active if any workstream is still active
    console.log("[isInProgress] Multiple workstreams but no main, checking if any are still active");

    for (const [workstreamId, msgs] of workstreamMessages.entries()) {
        if (msgs.length > 0) {
            const lastMessage = msgs[msgs.length - 1];
            if (!DONE_STATES.includes(
                lastMessage.type
            )) {
                console.log(`[isInProgress] Workstream ${workstreamId} is still active`);
                return true;
            }
        }
    }

    console.log("[isInProgress] All workstreams are completed");
    return false;
}

export const formatRelative = (ts: number | string) =>
    typeof ts === "number" ? dayjs(ts).fromNow() : dayjs(new Date(ts)).fromNow();

/**
 * Extract the workstream ID from a message
 * @param message The agent message to analyze
 * @returns The workstream ID (defaults to 'main' if none found)
 */
export function getWorkstreamId(message: AgentMessage): string {
    // Only use the direct workstream_id property on the message
    if (message.workstream_id) {
        // For debugging COMPLETE messages
        if (message.type === AgentMessageType.COMPLETE) {
            console.log("[getWorkstreamId] COMPLETE message with workstream_id:", message.workstream_id);
        }
        return message.workstream_id;
    }

    // For debugging COMPLETE messages without workstream_id
    if (message.type === AgentMessageType.COMPLETE) {
        console.log("[getWorkstreamId] COMPLETE message without workstream_id, defaulting to 'main'");
    }

    // Default to 'main' workstream
    return "main";
}

/**
 * Get a map of workstream IDs to their completion status
 * @param messages List of agent messages
 * @returns Map of workstream IDs to completion status ('pending', 'in_progress', or 'completed')
 */
export function getWorkstreamStatusMap(messages: AgentMessage[]): Map<string, "pending" | "in_progress" | "completed"> {
    const workstreamMessages = new Map<string, AgentMessage[]>();
    const statusMap = new Map<string, "pending" | "in_progress" | "completed">();

    // Group messages by workstream
    messages.forEach((message) => {
        const workstreamId = getWorkstreamId(message);
        if (!workstreamMessages.has(workstreamId)) {
            workstreamMessages.set(workstreamId, []);
            // Initialize all workstreams as pending
            statusMap.set(workstreamId, "pending");
        }
        workstreamMessages.get(workstreamId)!.push(message);
    });

    // Log all workstreams found
    console.log("[getWorkstreamStatusMap] Found workstreams:", Array.from(workstreamMessages.keys()));

    // Determine status based on last message type
    for (const [workstreamId, msgs] of workstreamMessages.entries()) {
        if (msgs.length > 0) {
            // Mark as in_progress by default if there are any messages
            statusMap.set(workstreamId, "in_progress");

            // Check if completed based on last message or any COMPLETE message
            const lastMessage = msgs[msgs.length - 1];

            // Check for any COMPLETE message in this workstream
            const hasCompleteMessage = msgs.some(msg =>
                msg.type === AgentMessageType.COMPLETE &&
                (msg.workstream_id === workstreamId || (!msg.workstream_id && workstreamId === 'main'))
            );

            if (hasCompleteMessage ||
                DONE_STATES.includes(lastMessage.type)) {
                console.log(`[getWorkstreamStatusMap] Marking workstream ${workstreamId} as completed`);
                statusMap.set(workstreamId, "completed");
            } else {
                console.log(`[getWorkstreamStatusMap] Workstream ${workstreamId} is in_progress`);
            }
        }
    }

    // Log final status map for debugging
    console.log("[getWorkstreamStatusMap] Final status map:",
        Array.from(statusMap.entries()).map(([id, status]) => `${id}: ${status}`).join(', '));

    return statusMap;
}

// Helper function to get conversation URL - used by other components
export async function getConversationUrl(
    vertesia: VertesiaClient,
    workflowRunId: string,
): Promise<string> {
    return vertesia.files
        .getDownloadUrl(`agents/${workflowRunId}/conversation.json`)
        .then((r) => r.url);
}

/**
 * Represents a group of messages for display purposes
 * Either a single message or a group of consecutive tool calls
 */
export type MessageGroup =
    | { type: 'single'; message: AgentMessage }
    | { type: 'tool_group'; messages: AgentMessage[]; firstTimestamp: number | string };

/**
 * Streaming message data structure
 */
export interface StreamingData {
    text: string;
    workstreamId?: string;
    isComplete?: boolean;
    startTimestamp: number;
}

/**
 * Tool execution status for display purposes
 */
export type ToolExecutionStatus = "running" | "completed" | "error" | "warning";

/**
 * Extended group type that includes streaming messages for interleaved rendering
 */
export type RenderableGroup =
    | { type: 'single'; message: AgentMessage }
    | { type: 'tool_group'; messages: AgentMessage[]; firstTimestamp: number; toolRunId?: string; toolStatus?: ToolExecutionStatus }
    | { type: 'streaming'; streamingId: string; text: string; workstreamId?: string; startTimestamp: number; isComplete?: boolean };

/**
 * Check if a message is a tool call (THOUGHT with tool details)
 */
export function isToolCallMessage(message: AgentMessage): boolean {
    return message.type === AgentMessageType.THOUGHT && !!message.details?.tool;
}

/**
 * Get the tool_run_id from a message's details, if present
 */
export function getToolRunId(message: AgentMessage): string | undefined {
    return message.details?.tool_run_id;
}

/**
 * Get the tool_iteration from a message's details, if present
 * This is used to group parallel tool calls from the same iteration
 */
export function getToolIteration(message: AgentMessage): number | undefined {
    return message.details?.tool_iteration;
}

/**
 * Get the tool execution status from a message's details
 */
export function getToolStatus(message: AgentMessage): ToolExecutionStatus | undefined {
    return message.details?.tool_status;
}

/**
 * Group consecutive tool call messages together for a cleaner display
 * Non-tool messages remain as single items
 *
 * @param messages Sorted array of messages
 * @returns Array of message groups
 */
export function groupConsecutiveToolCalls(messages: AgentMessage[]): MessageGroup[] {
    const groups: MessageGroup[] = [];
    let currentToolGroup: AgentMessage[] = [];

    const flushToolGroup = () => {
        if (currentToolGroup.length > 0) {
            if (currentToolGroup.length === 1) {
                // Single tool call - no need to group
                groups.push({ type: 'single', message: currentToolGroup[0] });
            } else {
                // Multiple consecutive tool calls - group them
                groups.push({
                    type: 'tool_group',
                    messages: currentToolGroup,
                    firstTimestamp: currentToolGroup[0].timestamp
                });
            }
            currentToolGroup = [];
        }
    };

    for (const message of messages) {
        if (isToolCallMessage(message)) {
            currentToolGroup.push(message);
        } else {
            // Flush any pending tool group before adding non-tool message
            flushToolGroup();
            groups.push({ type: 'single', message });
        }
    }

    // Flush any remaining tool group
    flushToolGroup();

    return groups;
}

/**
 * Helper to get timestamp as number
 */
function getTimestampMs(timestamp: number | string): number {
    return typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
}

/**
 * Group messages with streaming messages interleaved in chronological order
 * Messages with the same tool_iteration are grouped together (parallel tool calls)
 * Messages with the same tool_run_id are grouped together (same tool execution)
 * Messages without either fall back to consecutive grouping
 *
 * @param messages Sorted array of messages
 * @param streamingMessages Map of streaming messages by ID
 * @param activeWorkstream Optional workstream filter
 * @returns Array of renderable groups with streaming interleaved
 */
export function groupMessagesWithStreaming(
    messages: AgentMessage[],
    streamingMessages: Map<string, StreamingData>,
    activeWorkstream?: string
): RenderableGroup[] {
    // First pass: collect messages by tool_iteration (for parallel tool calls in same iteration)
    const iterationGroups = new Map<number, {
        messages: AgentMessage[];
        firstTimestamp: number;
    }>();

    // Also collect messages by tool_run_id (for sub-messages within same tool)
    const toolRunGroups = new Map<string, {
        messages: AgentMessage[];
        firstTimestamp: number;
    }>();

    // Messages without tool_iteration or tool_run_id will be processed separately
    const standaloneMessages: AgentMessage[] = [];

    for (const message of messages) {
        if (isToolCallMessage(message)) {
            const toolIteration = getToolIteration(message);
            const toolRunId = getToolRunId(message);

            if (toolIteration !== undefined) {
                // Group by tool_iteration - this groups parallel tool calls together
                if (!iterationGroups.has(toolIteration)) {
                    iterationGroups.set(toolIteration, {
                        messages: [],
                        firstTimestamp: getTimestampMs(message.timestamp)
                    });
                }
                iterationGroups.get(toolIteration)!.messages.push(message);
            } else if (toolRunId) {
                // Fallback: group by tool_run_id if no iteration
                if (!toolRunGroups.has(toolRunId)) {
                    toolRunGroups.set(toolRunId, {
                        messages: [],
                        firstTimestamp: getTimestampMs(message.timestamp)
                    });
                }
                toolRunGroups.get(toolRunId)!.messages.push(message);
            } else {
                // No tool_iteration or tool_run_id - will use consecutive grouping
                standaloneMessages.push(message);
            }
        } else {
            standaloneMessages.push(message);
        }
    }

    // Create unified list of items with timestamps
    type GroupedItem =
        | { kind: 'message'; message: AgentMessage; timestamp: number }
        | { kind: 'streaming'; streamingId: string; data: StreamingData; timestamp: number }
        | { kind: 'iteration_group'; iteration: number; messages: AgentMessage[]; timestamp: number }
        | { kind: 'tool_run'; toolRunId: string; messages: AgentMessage[]; timestamp: number };

    const items: GroupedItem[] = [];

    // Add iteration groups (parallel tool calls from same iteration)
    iterationGroups.forEach((group, iteration) => {
        items.push({
            kind: 'iteration_group',
            iteration,
            messages: group.messages,
            timestamp: group.firstTimestamp
        });
    });

    // Add tool_run groups as single items
    toolRunGroups.forEach((group, toolRunId) => {
        items.push({
            kind: 'tool_run',
            toolRunId,
            messages: group.messages,
            timestamp: group.firstTimestamp
        });
    });

    // Add standalone messages
    for (const message of standaloneMessages) {
        items.push({
            kind: 'message',
            message,
            timestamp: getTimestampMs(message.timestamp)
        });
    }

    // Add streaming messages (filter by workstream if specified)
    streamingMessages.forEach((data, streamingId) => {
        // Skip empty streaming messages
        if (!data.text) return;

        // Filter by workstream if specified
        if (activeWorkstream && activeWorkstream !== "all") {
            const streamWorkstream = data.workstreamId || "main";
            if (activeWorkstream !== streamWorkstream) return;
        }

        items.push({
            kind: 'streaming',
            streamingId,
            data,
            timestamp: data.startTimestamp
        });
    });

    // Sort by timestamp, but incomplete streaming goes at the end
    // Complete/final streaming messages stay at their chronological position
    items.sort((a, b) => {
        const aIsIncompleteStreaming = a.kind === 'streaming' && !a.data.isComplete;
        const bIsIncompleteStreaming = b.kind === 'streaming' && !b.data.isComplete;

        // Only incomplete streaming messages go last
        if (aIsIncompleteStreaming && !bIsIncompleteStreaming) return 1;
        if (bIsIncompleteStreaming && !aIsIncompleteStreaming) return -1;

        // Both are same type (both incomplete streaming, both complete, or both non-streaming): sort by timestamp
        return a.timestamp - b.timestamp;
    });

    // Build final groups with consecutive grouping for standalone tool messages
    const groups: RenderableGroup[] = [];
    let currentToolGroup: AgentMessage[] = [];

    const flushToolGroup = () => {
        if (currentToolGroup.length > 0) {
            if (currentToolGroup.length === 1) {
                groups.push({ type: 'single', message: currentToolGroup[0] });
            } else {
                groups.push({
                    type: 'tool_group',
                    messages: currentToolGroup,
                    firstTimestamp: getTimestampMs(currentToolGroup[0].timestamp)
                });
            }
            currentToolGroup = [];
        }
    };

    for (const item of items) {
        if (item.kind === 'streaming') {
            // Streaming breaks consecutive tool grouping
            flushToolGroup();
            groups.push({
                type: 'streaming',
                streamingId: item.streamingId,
                text: item.data.text,
                workstreamId: item.data.workstreamId,
                startTimestamp: item.data.startTimestamp,
                isComplete: item.data.isComplete
            });
        } else if (item.kind === 'iteration_group') {
            // Iteration group - parallel tool calls from same iteration
            flushToolGroup();
            // Sort messages within the group by timestamp
            const sortedMessages = [...item.messages].sort(
                (a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp)
            );
            // Get the latest status from the group
            const latestStatus = sortedMessages.reduce<ToolExecutionStatus | undefined>(
                (status, msg) => getToolStatus(msg) || status,
                undefined
            );
            groups.push({
                type: 'tool_group',
                messages: sortedMessages,
                firstTimestamp: item.timestamp,
                toolStatus: latestStatus
            });
        } else if (item.kind === 'tool_run') {
            // Tool run group - already grouped by tool_run_id
            flushToolGroup();
            // Sort messages within the group by timestamp
            const sortedMessages = [...item.messages].sort(
                (a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp)
            );
            // Get the latest status from the group
            const latestStatus = sortedMessages.reduce<ToolExecutionStatus | undefined>(
                (status, msg) => getToolStatus(msg) || status,
                undefined
            );
            groups.push({
                type: 'tool_group',
                messages: sortedMessages,
                firstTimestamp: item.timestamp,
                toolRunId: item.toolRunId,
                toolStatus: latestStatus
            });
        } else if (isToolCallMessage(item.message)) {
            // Standalone tool message - use consecutive grouping
            currentToolGroup.push(item.message);
        } else {
            // Non-tool message breaks grouping
            flushToolGroup();
            groups.push({ type: 'single', message: item.message });
        }
    }

    // Flush any remaining tool group
    flushToolGroup();

    return groups;
}

/**
 * Tool call information extracted from messages for observability view
 */
export interface ToolCallInfo {
    toolName: string;
    toolUseId?: string;
    toolRunId?: string;
    toolType?: 'builtin' | 'interaction' | 'remote' | 'skill';
    iteration?: number;
    timestamp: number;
    durationMs?: number;
    status: ToolExecutionStatus;
    parameters?: Record<string, unknown>;
    result?: string;
    error?: {
        type: string;
        message: string;
    };
    files?: any[];
    workstreamId?: string;
    message: AgentMessage; // Keep reference to original message for details
}

/**
 * Summary statistics for tool calls
 */
export interface ToolCallMetrics {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    warningCalls: number;
    runningCalls: number;
    averageDurationMs?: number;
    totalDurationMs?: number;
    toolsByName: Map<string, number>;
    mostUsedTool?: string;
}

/**
 * Extract tool call information from THOUGHT messages with tool details
 */
export function extractToolCalls(messages: AgentMessage[]): ToolCallInfo[] {
    const toolCalls: ToolCallInfo[] = [];

    for (const message of messages) {
        if (!isToolCallMessage(message)) continue;

        const details = message.details || {};
        const toolName = details.tool || 'unknown';
        const status = getToolStatus(message) || 'running';

        const toolCall: ToolCallInfo = {
            toolName,
            toolUseId: details.tool_use_id,
            toolRunId: getToolRunId(message),
            toolType: details.tool_type,
            iteration: getToolIteration(message),
            timestamp: getTimestampMs(message.timestamp),
            status,
            parameters: details.parameters,
            result: message.message,
            files: details.files || details.outputFiles,
            workstreamId: getWorkstreamId(message),
            message, // Keep reference for full details
        };

        // Extract duration if available
        if (details.duration_ms !== undefined) {
            toolCall.durationMs = details.duration_ms;
        }

        // Extract error information
        if (status === 'error' && details.error) {
            toolCall.error = {
                type: details.error.type || 'unknown',
                message: details.error.message || message.message,
            };
        }

        toolCalls.push(toolCall);
    }

    return toolCalls;
}

/**
 * Calculate summary statistics for tool calls
 */
export function calculateToolMetrics(toolCalls: ToolCallInfo[]): ToolCallMetrics {
    const metrics: ToolCallMetrics = {
        totalCalls: toolCalls.length,
        successfulCalls: 0,
        failedCalls: 0,
        warningCalls: 0,
        runningCalls: 0,
        toolsByName: new Map<string, number>(),
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const call of toolCalls) {
        // Count by status
        switch (call.status) {
            case 'completed':
                metrics.successfulCalls++;
                break;
            case 'error':
                metrics.failedCalls++;
                break;
            case 'warning':
                metrics.warningCalls++;
                break;
            case 'running':
                metrics.runningCalls++;
                break;
        }

        // Count by tool name
        const currentCount = metrics.toolsByName.get(call.toolName) || 0;
        metrics.toolsByName.set(call.toolName, currentCount + 1);

        // Sum durations
        if (call.durationMs !== undefined) {
            totalDuration += call.durationMs;
            durationCount++;
        }
    }

    // Calculate average duration
    if (durationCount > 0) {
        metrics.averageDurationMs = totalDuration / durationCount;
        metrics.totalDurationMs = totalDuration;
    }

    // Find most used tool
    let maxCount = 0;
    for (const [toolName, count] of metrics.toolsByName.entries()) {
        if (count > maxCount) {
            maxCount = count;
            metrics.mostUsedTool = toolName;
        }
    }

    return metrics;
}

/**
 * Extract tool call information from workflow history events
 * This is used by the observability tab to show tool execution traces
 */
export function extractToolCallsFromHistory(history: WorkflowRunEvent[]): ToolCallInfo[] {
    if (!history || history.length === 0) {
        return [];
    }

    // Group activities by ID to track their lifecycle
    const activityMap = new Map<string, {
        scheduled?: WorkflowRunEvent;
        started?: WorkflowRunEvent;
        completed?: WorkflowRunEvent;
        failed?: WorkflowRunEvent;
    }>();

    // Build event lookup by event_id for resolving scheduledEventId references
    const eventById = new Map<number, WorkflowRunEvent>();
    for (const event of history) {
        if (event.event_id) {
            eventById.set(event.event_id, event);
        }
    }

    // First pass: collect all activity events by ID
    // Note: For scheduled events, activity.id is present
    // For started/completed/failed events, we need to look up the scheduled event via scheduledEventId
    let eventTypesSeen = new Set<string>();
    for (const event of history) {
        if (!event.activity) continue;

        let activityId: string | undefined;

        // Scheduled events have the activity ID directly
        if (event.event_type === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED' && event.activity.id) {
            activityId = event.activity.id;
        }
        // Other activity events reference the scheduled event
        else if (event.activity.scheduledEventId) {
            const scheduledEventId = Number(event.activity.scheduledEventId);
            const scheduledEvent = eventById.get(scheduledEventId);
            if (scheduledEvent?.activity?.id) {
                activityId = scheduledEvent.activity.id;
            }
        }

        if (!activityId) continue;

        if (!activityMap.has(activityId)) {
            activityMap.set(activityId, {});
        }

        const lifecycle = activityMap.get(activityId)!;

        if (event.event_type === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED') {
            lifecycle.scheduled = event;
        } else if (event.event_type === 'EVENT_TYPE_ACTIVITY_TASK_STARTED') {
            lifecycle.started = event;
        } else if (event.event_type === 'EVENT_TYPE_ACTIVITY_TASK_COMPLETED') {
            lifecycle.completed = event;
        } else if (event.event_type === 'EVENT_TYPE_ACTIVITY_TASK_FAILED') {
            lifecycle.failed = event;
        }

        eventTypesSeen.add(event.event_type);
    }

    // Second pass: extract tool calls from activities that have tool payloads
    const toolCalls: ToolCallInfo[] = [];

    let activityIndex = 0;

    for (const [activityId, lifecycle] of activityMap.entries()) {
        activityIndex++;
        const scheduled = lifecycle.scheduled;

        if (!scheduled?.activity?.input) continue;

        // Parse the activity input to check if it's a tool activity
        // Note: Activity input from the server is a string or string array (JSON stringified)
        let payload: any;
        try {
            if (Array.isArray(scheduled.activity.input) && scheduled.activity.input.length > 0) {
                // input is an array of JSON strings - parse the first one
                const firstInput = scheduled.activity.input[0];
                payload = typeof firstInput === 'string' ? JSON.parse(firstInput) : firstInput;
            } else if (typeof scheduled.activity.input === 'string') {
                // input is a single JSON string
                payload = JSON.parse(scheduled.activity.input);
            } else {
                // input is already an object (shouldn't happen based on server code)
                payload = scheduled.activity.input;
            }

            // Check if this is a tool activity (has toolName and toolUseId)
            if (!payload || typeof payload !== 'object') {
                continue;
            }
            if (!payload.toolName || !payload.toolUseId) {
                continue;
            }

            // Determine status based on lifecycle
            let status: ToolExecutionStatus = 'running';
            let durationMs: number | undefined;
            let result: string | undefined;
            let error: { type: string; message: string; } | undefined;

            if (lifecycle.completed) {
                durationMs = lifecycle.completed.event_time - scheduled.event_time;
                // Extract result if available
                if (lifecycle.completed.result) {
                    try {
                        // Parse the result to check if it's an error
                        // Note: Result might be an array like input (JSON stringified)
                        let parsedResult: any;
                        if (Array.isArray(lifecycle.completed.result) && lifecycle.completed.result.length > 0) {
                            // Result is an array of JSON strings - parse the first one
                            const firstResult = lifecycle.completed.result[0];
                            parsedResult = typeof firstResult === 'string' ? JSON.parse(firstResult) : firstResult;
                        } else if (typeof lifecycle.completed.result === 'string') {
                            try {
                                parsedResult = JSON.parse(lifecycle.completed.result);
                            } catch {
                                // Not JSON, treat as plain string
                                parsedResult = lifecycle.completed.result;
                            }
                        } else {
                            parsedResult = lifecycle.completed.result;
                        }

                        // Check if result indicates an error
                        if (parsedResult && typeof parsedResult === 'object' && parsedResult.is_error === true) {
                            status = 'error';
                            error = {
                                type: 'Tool Error',
                                message: parsedResult.content || 'The tool encountered an error',
                            };
                            result = parsedResult.content;
                        } else {
                            status = 'completed';
                            result = typeof parsedResult === 'string'
                                ? parsedResult
                                : JSON.stringify(parsedResult, null, 2);
                        }
                    } catch (err) {
                        console.warn('[extractToolCallsFromHistory] Failed to parse result:', err);
                        status = 'completed';
                        result = String(lifecycle.completed.result);
                    }
                } else {
                    status = 'completed';
                }
            } else if (lifecycle.failed) {
                status = 'error';
                durationMs = lifecycle.failed.event_time - scheduled.event_time;
                error = {
                    type: lifecycle.failed.error?.type || 'Error',
                    message: lifecycle.failed.error?.message || 'Activity failed',
                };
            } else if (lifecycle.started) {
                status = 'running';
            }

            // Extract parameters from payload.params.input
            let parameters: Record<string, unknown> | undefined;
            if (payload.params?.input) {
                const input = payload.params.input;
                // For remote tools, extract only the tool_input to hide MCP metadata
                if (payload.toolType === 'remote' && input.tool_use?.tool_input) {
                    parameters = input.tool_use.tool_input as Record<string, unknown>;
                } else {
                    parameters = input as Record<string, unknown>;
                }
            }

            const toolCall: ToolCallInfo = {
                toolName: payload.toolName,
                toolUseId: payload.toolUseId,
                toolRunId: activityId,
                toolType: payload.toolType,
                iteration: payload.iteration,
                timestamp: scheduled.event_time,
                status,
                parameters,
                result,
                error,
                durationMs,
                message: scheduled as any, // Keep reference for compatibility
            };

            toolCalls.push(toolCall);
        } catch (err) {
            console.warn('Failed to parse activity payload:', err);
            continue;
        }
    }

    // Sort by timestamp (ascending order)
    toolCalls.sort((a, b) => a.timestamp - b.timestamp);

    return toolCalls;
}