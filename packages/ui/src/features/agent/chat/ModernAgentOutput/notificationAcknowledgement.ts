import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import type { NotificationOccurrence } from '../../../notifications/NotificationAcknowledgement.js';
import { getAgentMessageText } from './requestInputMessages.js';
import { getWorkstreamId } from './utils.js';

/** Message types that can carry a notification occurrence: a request for the user, or an answer. */
const ACKNOWLEDGEABLE_TYPES: readonly AgentMessageType[] = [
    AgentMessageType.REQUEST_INPUT,
    AgentMessageType.ANSWER,
    AgentMessageType.COMPLETE,
];

const ANSWER_TYPES: readonly AgentMessageType[] = [AgentMessageType.ANSWER, AgentMessageType.COMPLETE];

/** Whether the transcript wraps this message so its notification can be acknowledged. */
export function isAcknowledgeableAgentMessage(message: AgentMessage): boolean {
    return ACKNOWLEDGEABLE_TYPES.includes(message.type);
}

/** `agent_request` occurrence of a question or tool approval: `<agentRunId>:<details.request_id>`. */
export function getRequestInputOccurrence(
    agentRunId: string | undefined,
    message: AgentMessage,
): NotificationOccurrence | undefined {
    if (!agentRunId || message.type !== AgentMessageType.REQUEST_INPUT) return undefined;
    const requestId = (message.details as { request_id?: unknown } | undefined)?.request_id;
    if (typeof requestId !== 'string' || !requestId) return undefined;
    return { type: 'agent_request', id: `${agentRunId}:${requestId}` };
}

/** The latest non-empty answer of the main conversation: the one that ends a run or a turn. */
export function findLatestAnswerMessage(messages: readonly AgentMessage[]): AgentMessage | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (!ANSWER_TYPES.includes(message.type)) continue;
        if (getWorkstreamId(message) !== 'main') continue;
        if (getAgentMessageText(message)) return message;
    }
    return undefined;
}

/** Main-workstream message types that settle whether the run ended or waits for the user. */
const RUN_STATE_TYPES: readonly AgentMessageType[] = [
    AgentMessageType.COMPLETE,
    AgentMessageType.TERMINATED,
    AgentMessageType.IDLE,
    AgentMessageType.REQUEST_INPUT,
    AgentMessageType.QUESTION,
];

/**
 * Whether the run ended (its latest state message is COMPLETE or TERMINATED), as opposed to an
 * interactive run waiting for the user's next message (IDLE).
 */
export function hasAgentRunEnded(messages: readonly AgentMessage[]): boolean {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (getWorkstreamId(message) !== 'main' || !RUN_STATE_TYPES.includes(message.type)) continue;
        return message.type === AgentMessageType.COMPLETE || message.type === AgentMessageType.TERMINATED;
    }
    return false;
}

function isSameMessage(a: AgentMessage, b: AgentMessage): boolean {
    // Render groups may copy messages, so identity alone is not enough.
    return a === b || (a.type === b.type && a.timestamp === b.timestamp && getWorkstreamId(a) === getWorkstreamId(b));
}

export interface AgentAcknowledgementState {
    agentRunId?: string;
    /** From {@link findLatestAnswerMessage}; matched by type, timestamp and workstream. */
    latestAnswer?: AgentMessage;
    /** From {@link hasAgentRunEnded}. */
    isRunCompleted: boolean;
    /** The agent is still producing output for the current turn. */
    isAgentWorking: boolean;
}

/**
 * The occurrences a rendered message acknowledges:
 * - a REQUEST_INPUT message: its `agent_request`;
 * - the latest answer of a run that ended: `agent_run_end`, and `agent_turn` for the turns before it;
 * - the latest answer of an interactive run waiting for the user: `agent_turn`.
 */
export function getAgentMessageAcknowledgement(
    message: AgentMessage,
    state: AgentAcknowledgementState,
): NotificationOccurrence[] | undefined {
    const { agentRunId } = state;
    if (!agentRunId) return undefined;
    const request = getRequestInputOccurrence(agentRunId, message);
    if (request) return [request];
    if (!state.latestAnswer || !isSameMessage(message, state.latestAnswer) || state.isAgentWorking) return undefined;
    const turn: NotificationOccurrence = { type: 'agent_turn', id: agentRunId };
    return state.isRunCompleted ? [{ type: 'agent_run_end', id: agentRunId }, turn] : [turn];
}
