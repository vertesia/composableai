import dayjs from "dayjs";
import { AgentMessage, AgentMessageType } from "@vertesia/common";
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

    // Sort by timestamp, but streaming always goes at the end
    items.sort((a, b) => {
        // Streaming messages always come last
        if (a.kind === 'streaming' && b.kind !== 'streaming') return 1;
        if (b.kind === 'streaming' && a.kind !== 'streaming') return -1;
        // Both streaming or both non-streaming: sort by timestamp
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