import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { getToolStatus, isStreamReplacedByMessage, isToolActivityMessage, StreamingData, ToolExecutionStatus } from "./utils";

export type SummaryConversationItem =
    | { type: "message"; message: AgentMessage }
    | {
        type: "work";
        id: string;
        messages: AgentMessage[];
        isActive: boolean;
        status: ToolExecutionStatus;
        startTimestamp: number | string;
        endTimestamp?: number | string;
    };

function getMessageText(message: AgentMessage): string {
    if (!message.message) return "";
    if (typeof message.message === "object") return JSON.stringify(message.message, null, 2);
    return String(message.message).trim();
}

function isLowSignalSummaryText(text: string): boolean {
    const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
    return normalized === "thinking" ||
        normalized === "thinking..." ||
        normalized === "working" ||
        normalized === "working..." ||
        normalized === "waiting" ||
        normalized === "waiting...";
}

export function isTransientThinkingMessage(message: AgentMessage): boolean {
    return message.type === AgentMessageType.THOUGHT && message.details?.display_role === "thinking";
}

function getTimestampMs(timestamp: number | string | undefined): number {
    if (typeof timestamp === "number") return timestamp;
    if (!timestamp) return -Infinity;
    const parsed = new Date(timestamp).getTime();
    return Number.isFinite(parsed) ? parsed : -Infinity;
}

function getLatestMessageTimestamp(messages: AgentMessage[]): number {
    return messages.reduce((latest, message) => Math.max(latest, getTimestampMs(message.timestamp)), -Infinity);
}

const TOOL_PREAMBLE_MATCH_WINDOW_MS = 60_000;

function filterTransientThinkingMessages(
    messages: AgentMessage[],
    isActive: boolean,
    latestObservedTimestamp: number,
): AgentMessage[] {
    if (!messages.some(isTransientThinkingMessage)) return messages;
    if (!isActive) return messages.filter((message) => !isTransientThinkingMessage(message));

    let lastNonThinkingIndex = -1;
    let lastThinkingIndex = -1;

    messages.forEach((message, index) => {
        if (isTransientThinkingMessage(message)) {
            lastThinkingIndex = index;
        } else {
            lastNonThinkingIndex = index;
        }
    });

    return messages.filter((message, index) => {
        if (!isTransientThinkingMessage(message)) return true;

        // Keep only the current trailing thinking state. Any later observed
        // persisted or streaming message makes the marker stale.
        return index === lastThinkingIndex &&
            index > lastNonThinkingIndex &&
            getTimestampMs(message.timestamp) >= latestObservedTimestamp;
    });
}

export function isSummaryAssistantProseMessage(message: AgentMessage): boolean {
    const text = getMessageText(message);
    if (!text || isLowSignalSummaryText(text)) return false;

    if (message.type === AgentMessageType.ANSWER) return true;

    if (message.details?.display_role === "tool_preamble") return false;

    // Streamed thoughts without tool metadata are model-visible prose. They remain
    // in the conversation unless buildSummaryDisplayMessages classifies them as
    // tool preambles by matching nearby tool activity.
    return message.type === AgentMessageType.THOUGHT && Boolean(message.details?.streamed);
}

function isSummaryPrimaryMessage(message: AgentMessage): boolean {
    return message.type === AgentMessageType.QUESTION ||
        isSummaryAssistantProseMessage(message) ||
        message.type === AgentMessageType.REQUEST_INPUT ||
        message.type === AgentMessageType.TERMINATED ||
        message.type === AgentMessageType.ERROR ||
        message.type === AgentMessageType.WARNING;
}

function getSummaryWorkStatus(messages: AgentMessage[], isActive: boolean): ToolExecutionStatus {
    if (messages.some((message) => message.type === AgentMessageType.ERROR || message.details?.tool_status === "error")) {
        return "error";
    }
    if (messages.some((message) => message.type === AgentMessageType.WARNING || message.details?.tool_status === "warning")) {
        return "warning";
    }
    return isActive ? "running" : "completed";
}

function getConcreteToolKey(message: AgentMessage): string | undefined {
    const details = message.details;
    if (!details) return undefined;

    if (typeof details.tool_run_id === "string" && details.tool_run_id.trim()) return `run:${details.tool_run_id}`;
    if (typeof details.activity_id === "string" && details.activity_id.trim()) return `activity:${details.activity_id}`;
    if (typeof details.activity_group_id === "string" && details.activity_group_id.trim()) {
        return `group:${details.activity_group_id}`;
    }
    if (typeof details.tool === "string" && details.tool.trim()) return `tool:${details.tool}`;
    return undefined;
}

function isConcreteToolExecutionMessage(message: AgentMessage): boolean {
    return isToolActivityMessage(message) && getToolStatus(message) !== undefined;
}

function hasConcreteToolExecution(messages: AgentMessage[]): boolean {
    return messages.some(isConcreteToolExecutionMessage);
}

function hasActiveConcreteToolExecution(messages: AgentMessage[]): boolean {
    const latestStatusByKey = new Map<string, ToolExecutionStatus>();
    let unkeyedRunningCount = 0;

    messages.forEach((message) => {
        if (!isConcreteToolExecutionMessage(message)) return;

        const status = getToolStatus(message);
        if (!status) return;

        const key = getConcreteToolKey(message);
        if (!key) {
            if (status === "running") unkeyedRunningCount += 1;
            return;
        }
        latestStatusByKey.set(key, status);
    });

    return unkeyedRunningCount > 0 ||
        Array.from(latestStatusByKey.values()).some((status) => status === "running");
}

function shouldSplitPostToolThinking(message: AgentMessage, pendingWork: AgentMessage[]): boolean {
    return isTransientThinkingMessage(message) &&
        hasConcreteToolExecution(pendingWork) &&
        !hasActiveConcreteToolExecution(pendingWork);
}

function shouldResumeCompletedWorkForTool(message: AgentMessage, pendingWork: AgentMessage[]): boolean {
    return isToolActivityMessage(message) &&
        !isTransientThinkingMessage(message) &&
        pendingWork.length > 0 &&
        pendingWork.every(isTransientThinkingMessage);
}

function isSummaryWorkMessage(message: AgentMessage): boolean {
    if (isSummaryAssistantProseMessage(message)) return false;
    if (isToolActivityMessage(message)) return true;
    if (message.type === AgentMessageType.UPDATE || message.type === AgentMessageType.PLAN) return true;

    return message.type === AgentMessageType.THOUGHT && !message.details?.streamed;
}

export function buildSummaryConversationItems(
    messages: AgentMessage[],
    isCompleted: boolean,
    latestObservedTimestamp = getLatestMessageTimestamp(messages),
): SummaryConversationItem[] {
    const items: SummaryConversationItem[] = [];
    let pendingWork: AgentMessage[] = [];

    const flushWork = (isActive: boolean, endMessage?: AgentMessage) => {
        if (pendingWork.length === 0) return;

        const visibleWork = filterTransientThinkingMessages(pendingWork, isActive, latestObservedTimestamp);
        if (visibleWork.length === 0) {
            pendingWork = [];
            return;
        }

        const firstMessage = visibleWork[0];
        const lastMessage = visibleWork[visibleWork.length - 1];
        const status = getSummaryWorkStatus(visibleWork, isActive);
        items.push({
            type: "work",
            id: isActive
                ? `${firstMessage.timestamp}-active`
                : `${firstMessage.timestamp}-${lastMessage.timestamp}-${visibleWork.length}`,
            messages: visibleWork,
            isActive,
            status,
            startTimestamp: firstMessage.timestamp,
            endTimestamp: endMessage?.timestamp ?? lastMessage.timestamp,
        });
        pendingWork = [];
    };

    for (const message of messages) {
        if (message.type === AgentMessageType.COMPLETE || message.type === AgentMessageType.IDLE) {
            continue;
        }

        if (isSummaryWorkMessage(message)) {
            if (shouldResumeCompletedWorkForTool(message, pendingWork)) {
                const previousItem = items[items.length - 1];
                if (previousItem?.type === "work" && !previousItem.isActive) {
                    items.pop();
                    pendingWork = [...previousItem.messages, message];
                    continue;
                }
            }

            if (shouldSplitPostToolThinking(message, pendingWork)) {
                flushWork(false);
            }

            pendingWork.push(message);
            continue;
        }

        if (isSummaryPrimaryMessage(message)) {
            flushWork(false, message);
            items.push({ type: "message", message });
        }
    }

    const shouldCompletePendingWork = hasConcreteToolExecution(pendingWork) &&
        !hasActiveConcreteToolExecution(pendingWork) &&
        !pendingWork.some(isTransientThinkingMessage);

    flushWork(!isCompleted && !shouldCompletePendingWork);
    return items;
}

function findMatchingToolActivity(data: StreamingData, messages: AgentMessage[]): AgentMessage | undefined {
    const exactMatch = data.activityId
        ? messages.find((message) =>
            isToolActivityMessage(message) &&
            (message.details?.activity_id === data.activityId || message.details?.activity_group_id === data.activityId))
        : undefined;
    if (exactMatch) return exactMatch;

    const streamStartMs = getTimestampMs(data.startTimestamp);
    if (!Number.isFinite(streamStartMs)) return undefined;

    const followingMessages = [...messages]
        .filter((message) => getTimestampMs(message.timestamp) >= streamStartMs)
        .sort((a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp));

    for (const message of followingMessages) {
        const messageMs = getTimestampMs(message.timestamp);
        if (messageMs - streamStartMs > TOOL_PREAMBLE_MATCH_WINDOW_MS) return undefined;
        if (isToolActivityMessage(message)) return message;
        if (isSummaryPrimaryMessage(message)) return undefined;
    }

    return undefined;
}

export function buildSummaryDisplayMessages(
    messages: AgentMessage[],
    completeStreaming: Map<string, StreamingData>,
): AgentMessage[] {
    if (completeStreaming.size === 0) return messages;

    const workflowRunId = messages.find((message) => message.workflow_run_id)?.workflow_run_id ?? "";
    const streamingMessages: AgentMessage[] = [];

    completeStreaming.forEach((data, streamingId) => {
        const text = data.text.trim();
        if (!text || isStreamReplacedByMessage(data, messages)) return;
        const matchingToolMessage = findMatchingToolActivity(data, messages);

        streamingMessages.push({
            timestamp: data.startTimestamp,
            workflow_run_id: workflowRunId,
            type: matchingToolMessage ? AgentMessageType.THOUGHT : AgentMessageType.ANSWER,
            message: text,
            workstream_id: data.workstreamId,
            details: {
                activity_id: data.activityId,
                display_role: matchingToolMessage ? "tool_preamble" : undefined,
                source: "streaming_summary",
                streamed: true,
                streaming_id: streamingId,
                tools: matchingToolMessage?.details?.tool ? [matchingToolMessage.details.tool] : undefined,
            },
        });
    });

    if (streamingMessages.length === 0) return messages;

    return [...messages, ...streamingMessages].sort(
        (a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp),
    );
}

export function getSummaryConversationLatestTimestamp(
    items: SummaryConversationItem[],
    fallbackTimestamp: number | string,
): number | string {
    const latestItem = items[items.length - 1];
    if (!latestItem) return fallbackTimestamp;
    if (latestItem.type === "work") return latestItem.endTimestamp ?? latestItem.startTimestamp;
    return latestItem.message.timestamp ?? fallbackTimestamp;
}

export function getSummaryActivityAnchorTimestamp(
    items: SummaryConversationItem[],
    messages: AgentMessage[],
    fallbackTimestamp: number | string,
): number | string {
    const latestItem = items[items.length - 1];
    if (latestItem) {
        return latestItem.type === "work"
            ? latestItem.endTimestamp ?? latestItem.startTimestamp
            : latestItem.message.timestamp ?? fallbackTimestamp;
    }

    const earliestMessage = messages.reduce<{ timestamp?: number | string; ms: number }>(
        (earliest, message) => {
            const ms = getTimestampMs(message.timestamp);
            if (!Number.isFinite(ms) || ms >= earliest.ms) return earliest;
            return { timestamp: message.timestamp, ms };
        },
        { ms: Number.POSITIVE_INFINITY },
    );

    return earliestMessage.timestamp ?? fallbackTimestamp;
}

export function shouldShowSummaryActivityFallback(
    items: SummaryConversationItem[],
    isAgentWorking: boolean,
    hasIncompleteStreaming: boolean,
): boolean {
    if (!isAgentWorking || hasIncompleteStreaming) return false;
    if (items.some((item) => item.type === "work" && item.isActive)) return false;

    const latestItem = items[items.length - 1];
    if (!latestItem) return true;
    if (latestItem.type === "work") return true;

    // A user/request message means the client is waiting for the first
    // persisted activity. Assistant or terminal messages mean the user-visible
    // result already arrived; a delayed idle marker should not flash activity.
    return latestItem.message.type === AgentMessageType.QUESTION;
}
