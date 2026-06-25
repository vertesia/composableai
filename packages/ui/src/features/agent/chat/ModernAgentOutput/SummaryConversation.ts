import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import {
    getWorkstreamActivityDetails,
    getWorkstreamLaunchDetails,
    isWorkstreamInternalResultMessage,
    isWorkstreamInternalResultText,
} from '../workstreams.js';
import { isToolApprovalRequestInput } from './requestInputMessages';
import {
    isStreamReplacedByMessage,
    isToolActivityMessage,
    isToolPreambleMessage,
    isUserStoppedMessage,
    type StreamingData,
    type ToolExecutionStatus,
} from './utils';

export type SummaryConversationItem =
    | { type: 'message'; message: AgentMessage }
    | {
          type: 'stopped';
          message: AgentMessage;
          startTimestamp: number | string;
          endTimestamp: number | string;
      }
    | {
          type: 'work';
          id: string;
          messages: AgentMessage[];
          isActive: boolean;
          status: ToolExecutionStatus;
          startTimestamp: number | string;
          endTimestamp?: number | string;
      };

function getMessageText(message: AgentMessage): string {
    if (!message.message) return '';
    if (typeof message.message === 'object') return JSON.stringify(message.message, null, 2);
    return String(message.message).trim();
}

function isLowSignalSummaryText(text: string): boolean {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
    return (
        normalized === 'thinking' ||
        normalized === 'thinking...' ||
        normalized === 'working' ||
        normalized === 'working...' ||
        normalized === 'waiting' ||
        normalized === 'waiting...'
    );
}

export function isTransientThinkingMessage(message: AgentMessage): boolean {
    return message.type === AgentMessageType.THOUGHT && message.details?.display_role === 'thinking';
}

export function isTransientWorkStatusMessage(message: AgentMessage): boolean {
    if (isTransientThinkingMessage(message)) return true;
    if (message.type !== AgentMessageType.WARNING) return false;

    const details = message.details;
    const normalizedText = getMessageText(message)
        .replace(/^[^A-Za-z0-9]+/, '')
        .toLowerCase();

    return (
        typeof details?.attempt === 'number' &&
        typeof details?.maxAttempts === 'number' &&
        typeof details?.estimatedBackoffSeconds === 'number' &&
        typeof details?.activityId === 'string' &&
        (normalizedText.startsWith('retrying operation') || normalizedText.startsWith('retrying checkpoint operation'))
    );
}

function getTimestampMs(timestamp: number | string | undefined): number {
    if (typeof timestamp === 'number') return timestamp;
    if (!timestamp) return -Infinity;
    const parsed = new Date(timestamp).getTime();
    return Number.isFinite(parsed) ? parsed : -Infinity;
}

function getLatestMessageTimestamp(messages: AgentMessage[]): number {
    return messages.reduce((latest, message) => Math.max(latest, getTimestampMs(message.timestamp)), -Infinity);
}

const TOOL_PREAMBLE_MATCH_WINDOW_MS = 60_000;

function getStringDetail(message: AgentMessage, key: 'activity_id' | 'activity_group_id'): string | undefined {
    const value = message.details?.[key];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

function filterTransientWorkStatusMessages(
    messages: AgentMessage[],
    isActive: boolean,
    latestObservedTimestamp: number,
): AgentMessage[] {
    if (!messages.some(isTransientWorkStatusMessage)) return messages;
    if (!isActive) return messages.filter((message) => !isTransientWorkStatusMessage(message));

    let lastNonTransientIndex = -1;
    let lastTransientIndex = -1;

    messages.forEach((message, index) => {
        if (isTransientWorkStatusMessage(message)) {
            lastTransientIndex = index;
        } else {
            lastNonTransientIndex = index;
        }
    });

    return messages.filter((message, index) => {
        if (!isTransientWorkStatusMessage(message)) return true;

        // Keep only the current trailing transient state. Any later observed
        // persisted or streaming message makes the marker stale.
        return (
            index === lastTransientIndex &&
            index > lastNonTransientIndex &&
            getTimestampMs(message.timestamp) >= latestObservedTimestamp
        );
    });
}

export function isSummaryAssistantProseMessage(message: AgentMessage): boolean {
    if (isWorkstreamInternalResultMessage(message)) return false;

    const text = getMessageText(message);
    if (!text || isLowSignalSummaryText(text)) return false;

    if (message.type === AgentMessageType.ANSWER) return true;

    if (isToolPreambleMessage(message)) return false;

    // Streamed thoughts without tool metadata are model-visible prose. They remain
    // in the conversation unless buildSummaryDisplayMessages classifies them as
    // tool preambles by matching nearby tool activity.
    return message.type === AgentMessageType.THOUGHT && Boolean(message.details?.streamed);
}

function isToolScopedStatusMessage(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.ERROR && message.type !== AgentMessageType.WARNING) return false;

    const details = message.details as
        | {
              activity_group_id?: unknown;
              tool?: unknown;
              tool_event?: unknown;
              tool_run_id?: unknown;
              tool_status?: unknown;
          }
        | undefined;

    return Boolean(
        details?.tool ||
            details?.tool_status ||
            details?.tool_run_id ||
            details?.activity_group_id ||
            details?.tool_event,
    );
}

function isLegacyAnalyzeConversationErrorMessage(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.ERROR || isToolScopedStatusMessage(message)) return false;

    const details = message.details as { error?: unknown } | undefined;
    return getMessageText(message).startsWith('Error analyzing conversation:') && typeof details?.error === 'string';
}

function isWorkstreamActivityFailureMessage(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.ERROR) return false;

    const details = message.details as
        | {
              activity_group_id?: unknown;
              event_class?: unknown;
              tool?: unknown;
              tool_event?: unknown;
              tool_run_id?: unknown;
              tool_status?: unknown;
              workstream_event?: unknown;
          }
        | undefined;

    if (details?.event_class !== 'activity') return false;
    if (details.workstream_event) return false;

    return !(
        details.tool ||
        details.tool_status ||
        details.tool_run_id ||
        details.activity_group_id ||
        details.tool_event
    );
}

function isSummaryPrimaryMessage(message: AgentMessage): boolean {
    if (isWorkstreamInternalResultMessage(message)) return false;
    if (isWorkstreamActivityFailureMessage(message)) return false;

    return (
        message.type === AgentMessageType.QUESTION ||
        Boolean(getWorkstreamLaunchDetails(message)) ||
        isSummaryAssistantProseMessage(message) ||
        (message.type === AgentMessageType.REQUEST_INPUT && !isToolApprovalRequestInput(message)) ||
        message.type === AgentMessageType.TERMINATED ||
        ((message.type === AgentMessageType.ERROR || message.type === AgentMessageType.WARNING) &&
            !isToolScopedStatusMessage(message) &&
            !isTransientWorkStatusMessage(message))
    );
}

function getMessageExecutionStatus(message: AgentMessage): ToolExecutionStatus | undefined {
    const status = message.details?.tool_status;
    if (status === 'running' || status === 'completed' || status === 'error' || status === 'warning') return status;
    if (message.type === AgentMessageType.ERROR) return 'error';
    if (message.type === AgentMessageType.WARNING) return 'warning';
    return undefined;
}

function getSummaryWorkStatus(messages: AgentMessage[], isActive: boolean): ToolExecutionStatus {
    for (let index = messages.length - 1; index >= 0; index--) {
        const status = getMessageExecutionStatus(messages[index]);
        if (status === 'error' || status === 'warning') return status;
        if (status) return isActive ? 'running' : 'completed';
    }

    return isActive ? 'running' : 'completed';
}

function shouldResumeCompletedWorkForTool(message: AgentMessage, pendingWork: AgentMessage[]): boolean {
    return (
        isToolActivityMessage(message) &&
        !isTransientThinkingMessage(message) &&
        pendingWork.length > 0 &&
        pendingWork.every(isTransientThinkingMessage)
    );
}

function isSummaryWorkMessage(message: AgentMessage): boolean {
    if (isWorkstreamInternalResultMessage(message)) return false;
    if (isSummaryAssistantProseMessage(message)) return false;
    if (getWorkstreamLaunchDetails(message)) return false;
    if (isWorkstreamActivityFailureMessage(message)) return true;
    if (isTransientWorkStatusMessage(message)) return true;
    if (isToolApprovalRequestInput(message)) return true;
    if (isToolScopedStatusMessage(message)) return true;
    if (isToolPreambleMessage(message)) return true;
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
    const seenWorkstreamStartIds = new Set<string>();

    const flushWork = (isActive: boolean, endMessage?: AgentMessage) => {
        if (pendingWork.length === 0) return;

        const visibleWork = filterTransientWorkStatusMessages(pendingWork, isActive, latestObservedTimestamp);
        if (visibleWork.length === 0) {
            pendingWork = [];
            return;
        }

        const firstMessage = visibleWork[0];
        const lastMessage = visibleWork[visibleWork.length - 1];
        const status = getSummaryWorkStatus(visibleWork, isActive);
        items.push({
            type: 'work',
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
        const launchDetails = getWorkstreamLaunchDetails(message);
        const activityStartDetails = launchDetails ? null : getWorkstreamActivityDetails(message);
        const workstreamStartDetails = launchDetails ?? activityStartDetails;

        if (workstreamStartDetails) {
            const hasSeenWorkstream = seenWorkstreamStartIds.has(workstreamStartDetails.workstreamId);
            seenWorkstreamStartIds.add(workstreamStartDetails.workstreamId);

            if (launchDetails || !hasSeenWorkstream) {
                flushWork(false, message);
                items.push({ type: 'message', message });
                continue;
            }
        }

        if (message.type === AgentMessageType.COMPLETE || message.type === AgentMessageType.IDLE) {
            if (isUserStoppedMessage(message)) {
                const pendingWorkStartTimestamp = pendingWork[0]?.timestamp;
                flushWork(false, message);
                const previousItem = items[items.length - 1];
                items.push({
                    type: 'stopped',
                    message,
                    startTimestamp:
                        pendingWorkStartTimestamp !== undefined && previousItem?.type === 'work'
                            ? previousItem.startTimestamp
                            : (pendingWorkStartTimestamp ?? message.timestamp),
                    endTimestamp: message.timestamp,
                });
                continue;
            }
            flushWork(false, message);
            continue;
        }

        if (
            isSummaryWorkMessage(message) ||
            (pendingWork.length > 0 && isLegacyAnalyzeConversationErrorMessage(message))
        ) {
            if (shouldResumeCompletedWorkForTool(message, pendingWork)) {
                const previousItem = items[items.length - 1];
                if (previousItem?.type === 'work' && !previousItem.isActive) {
                    items.pop();
                    pendingWork = [...previousItem.messages, message];
                    continue;
                }
            }

            pendingWork.push(message);
            continue;
        }

        if (isSummaryPrimaryMessage(message)) {
            flushWork(false, message);
            items.push({ type: 'message', message });
        }
    }

    flushWork(!isCompleted);
    return items;
}

function findMatchingToolActivity(data: StreamingData, messages: AgentMessage[]): AgentMessage | undefined {
    if (data.activityId) {
        const exactMatch = messages.find(
            (message) =>
                isToolActivityMessage(message) &&
                (getStringDetail(message, 'activity_id') === data.activityId ||
                    getStringDetail(message, 'activity_group_id') === data.activityId),
        );
        if (exactMatch) return exactMatch;

        const bridgedActivityGroupId = messages.find(
            (message) =>
                getStringDetail(message, 'activity_id') === data.activityId &&
                getStringDetail(message, 'activity_group_id'),
        )?.details?.activity_group_id;
        if (typeof bridgedActivityGroupId === 'string') {
            const bridgedMatch = messages.find(
                (message) =>
                    isToolActivityMessage(message) &&
                    getStringDetail(message, 'activity_group_id') === bridgedActivityGroupId,
            );
            if (bridgedMatch) return bridgedMatch;
        }
    }

    if (data.isComplete) {
        return undefined;
    }

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

    const workflowRunId = messages.find((message) => message.workflow_run_id)?.workflow_run_id ?? '';
    const streamingMessages: AgentMessage[] = [];

    completeStreaming.forEach((data, streamingId) => {
        const text = data.text.trim();
        if (!text || isStreamReplacedByMessage(data, messages)) return;
        if (isWorkstreamInternalResultText(text, data.workstreamId)) return;
        const matchingToolMessage = findMatchingToolActivity(data, messages);
        const matchingActivityGroupId = matchingToolMessage
            ? getStringDetail(matchingToolMessage, 'activity_group_id')
            : undefined;

        streamingMessages.push({
            timestamp: data.startTimestamp,
            workflow_run_id: workflowRunId,
            type: matchingToolMessage ? AgentMessageType.THOUGHT : AgentMessageType.ANSWER,
            message: text,
            workstream_id: data.workstreamId,
            details: {
                activity_id: data.activityId,
                activity_group_id: matchingActivityGroupId,
                display_role: matchingToolMessage ? 'tool_preamble' : undefined,
                source: 'streaming_summary',
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
    if (latestItem.type === 'work') return latestItem.endTimestamp ?? latestItem.startTimestamp;
    return latestItem.message.timestamp ?? fallbackTimestamp;
}

export function getSummaryActivityAnchorTimestamp(
    items: SummaryConversationItem[],
    messages: AgentMessage[],
    fallbackTimestamp: number | string,
): number | string {
    const latestItem = items[items.length - 1];
    if (latestItem) {
        return latestItem.type === 'work'
            ? (latestItem.endTimestamp ?? latestItem.startTimestamp)
            : (latestItem.message.timestamp ?? fallbackTimestamp);
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
    if (items.some((item) => item.type === 'work' && item.isActive)) return false;

    const latestItem = items[items.length - 1];
    if (!latestItem) return false;
    if (latestItem.type === 'work') return true;

    // A user/request message means the client is waiting for the first
    // persisted activity. Assistant or terminal messages mean the user-visible
    // result already arrived; a delayed idle marker should not flash activity.
    return latestItem.message.type === AgentMessageType.QUESTION;
}

export function isInitialSummaryActivityFallback(items: SummaryConversationItem[]): boolean {
    const latestItem = items[items.length - 1];
    if (!latestItem) return false;
    return latestItem.type === 'message' && latestItem.message.type === AgentMessageType.QUESTION && items.length === 1;
}
