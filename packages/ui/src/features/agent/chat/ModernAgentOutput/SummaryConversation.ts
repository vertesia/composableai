import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { isToolActivityMessage, ToolExecutionStatus } from "./utils";

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

function isTransientThinkingMessage(message: AgentMessage): boolean {
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

    // Tool preambles marked as streamed are model-visible prose that users already
    // saw while the agent was working. Keep them in Summary instead of swallowing
    // them into the work disclosure.
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
            pendingWork.push(message);
            continue;
        }

        if (isSummaryPrimaryMessage(message)) {
            flushWork(false, message);
            items.push({ type: "message", message });
        }
    }

    flushWork(!isCompleted);
    return items;
}
