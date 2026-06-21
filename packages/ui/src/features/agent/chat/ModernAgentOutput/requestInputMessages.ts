import { type AgentMessage, AgentMessageType, type AskUserMessageDetails } from '@vertesia/common';
import { getWorkstreamId } from './utils';

export type RequestInputMessageWithUx = AgentMessage & {
    details: AskUserMessageDetails & { ux: NonNullable<AskUserMessageDetails['ux']> };
};

export function getAgentMessageText(message: AgentMessage): string {
    if (!message.message) return '';
    if (typeof message.message === 'object') return JSON.stringify(message.message, null, 2);
    return String(message.message).trim();
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function hasRequestInputUx(message: AgentMessage): message is RequestInputMessageWithUx {
    const details = message.details as AskUserMessageDetails | undefined;
    return message.type === AgentMessageType.REQUEST_INPUT && !!details?.ux;
}

export function getRequestInputMessageKey(message: AgentMessage): string {
    const details = message.details as Record<string, unknown> | undefined;
    const keyParts = [
        details?.request_id,
        details?.requestId,
        details?.activity_id,
        details?.activityId,
        details?.tool_run_id,
        details?.toolRunId,
        message.timestamp,
        getAgentMessageText(message),
    ];
    return keyParts
        .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
        .map(String)
        .join('|');
}

export function getRequestInputAnswerMessageKey(message: AgentMessage): string {
    const details = message.details as Record<string, unknown> | undefined;
    const keyParts = [
        details?.ack,
        details?._messageId,
        details?._deliveryStatus,
        message.timestamp,
        getWorkstreamId(message),
        getAgentMessageText(message),
    ];
    return keyParts
        .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
        .map(String)
        .join('|');
}

export function getAnsweredRequestInputKeys(messages: AgentMessage[]): Set<string> {
    const answered = new Set<string>();

    messages.forEach((message, index) => {
        if (message.type !== AgentMessageType.REQUEST_INPUT) return;

        const workstreamId = getWorkstreamId(message);
        for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
            const nextMessage = messages[nextIndex];
            if (getWorkstreamId(nextMessage) !== workstreamId) continue;

            if (nextMessage.type === AgentMessageType.REQUEST_INPUT) break;
            if (nextMessage.type === AgentMessageType.QUESTION) {
                answered.add(getRequestInputMessageKey(message));
                break;
            }
        }
    });

    return answered;
}

export function getResolvedToolApprovalKeys(messages: AgentMessage[]): Set<string> {
    const resolved = new Set<string>();

    for (const message of messages) {
        const details = getRecord(message.details);
        const approvalRequest = getRecord(details?.approval_request);
        const approvalKey = approvalRequest?.approval_key;
        const decision = details?.approval_decision;

        if (
            typeof approvalKey === 'string' &&
            (decision === 'denied' || decision === 'timeout' || decision === 'reviewer_denied')
        ) {
            resolved.add(approvalKey);
        }
    }

    return resolved;
}

function getToolApprovalKey(message: AgentMessage): string | undefined {
    const details = getRecord(message.details);
    const toolApproval = getRecord(details?.tool_approval);
    const approvalKey = toolApproval?.approval_key;
    return typeof approvalKey === 'string' ? approvalKey : undefined;
}

function isToolApprovalResponse(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.QUESTION) return false;
    const normalized = getAgentMessageText(message).trim().toLowerCase();
    return normalized === 'allow_once' || normalized === 'allow_for_run' || normalized === 'deny';
}

export function isRequestInputResolvedByToolApprovalEvent(
    message: AgentMessage,
    resolvedToolApprovalKeys: Set<string>,
): boolean {
    if (message.type !== AgentMessageType.REQUEST_INPUT) return false;
    const approvalKey = getToolApprovalKey(message);
    return approvalKey ? resolvedToolApprovalKeys.has(approvalKey) : false;
}

export function getHiddenToolApprovalAnswerKeys(
    messages: AgentMessage[],
    resolvedToolApprovalKeys: Set<string>,
): Set<string> {
    const hidden = new Set<string>();

    messages.forEach((message, index) => {
        if (!isRequestInputResolvedByToolApprovalEvent(message, resolvedToolApprovalKeys)) return;

        const workstreamId = getWorkstreamId(message);
        for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
            const nextMessage = messages[nextIndex];
            if (getWorkstreamId(nextMessage) !== workstreamId) continue;
            if (nextMessage.type === AgentMessageType.REQUEST_INPUT) break;
            if (nextMessage.type === AgentMessageType.QUESTION) {
                if (isToolApprovalResponse(nextMessage)) {
                    hidden.add(getRequestInputAnswerMessageKey(nextMessage));
                }
                break;
            }
        }
    });

    return hidden;
}

export function isToolApprovalAnswerHidden(message: AgentMessage, hiddenToolApprovalAnswerKeys: Set<string>): boolean {
    return (
        message.type === AgentMessageType.QUESTION &&
        hiddenToolApprovalAnswerKeys.has(getRequestInputAnswerMessageKey(message))
    );
}

export function isRequestInputAnswered(message: AgentMessage, answeredRequestInputKeys: Set<string>): boolean {
    return (
        message.type === AgentMessageType.REQUEST_INPUT &&
        answeredRequestInputKeys.has(getRequestInputMessageKey(message))
    );
}

export function getPendingRequestInputMessage(
    messages: AgentMessage[],
    workstreamId = 'main',
): RequestInputMessageWithUx | undefined {
    const answeredRequestInputKeys = getAnsweredRequestInputKeys(messages);
    const resolvedToolApprovalKeys = getResolvedToolApprovalKeys(messages);

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!hasRequestInputUx(message)) continue;
        if (getWorkstreamId(message) !== workstreamId) continue;
        if (isRequestInputAnswered(message, answeredRequestInputKeys)) continue;
        if (isRequestInputResolvedByToolApprovalEvent(message, resolvedToolApprovalKeys)) continue;
        return message;
    }

    return undefined;
}
