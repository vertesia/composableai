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

export function getRequestInputDisplayText(message: AgentMessage): string {
    const toolApproval = getRecord((message.details as Record<string, unknown> | undefined)?.tool_approval);
    if (!toolApproval) return getAgentMessageText(message);

    const title = getString(toolApproval.tool_title) ?? getString(toolApproval.tool_name);
    const target = formatToolApprovalTargetForDisplay(getString(toolApproval.target));
    if (title && target) return `Approve ${title}: ${target}?`;

    const actionSummary = getString(toolApproval.action_summary);
    if (actionSummary) return `Approve ${formatToolApprovalActionSummaryForDisplay(actionSummary)}?`;

    return getAgentMessageText(message);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function formatToolApprovalActionSummaryForDisplay(actionSummary: string): string {
    return actionSummary.replace(/:\s*name(?::|\s+)/i, ': ');
}

function formatToolApprovalTargetForDisplay(target: string | undefined): string | undefined {
    if (!target) return undefined;

    const separatorIndex = target.indexOf(':');
    if (separatorIndex < 0) return target;

    const key = target.slice(0, separatorIndex);
    const value = target.slice(separatorIndex + 1).trim();
    if (!value) return target;

    switch (key) {
        case 'document_id':
            return `document ${value}`;
        case 'object_id':
            return `object ${value}`;
        case 'collection_id':
            return `collection ${value}`;
        case 'process_id':
            return `process ${value}`;
        case 'process_definition_id':
            return `process definition ${value}`;
        case 'interaction_id':
            return `interaction ${value}`;
        case 'prompt_id':
            return `prompt ${value}`;
        case 'dashboard_id':
            return `dashboard ${value}`;
        case 'database_id':
            return `database ${value}`;
        case 'table_id':
            return `table ${value}`;
        default:
            return value;
    }
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
            (decision === 'denied' ||
                decision === 'denied_with_feedback' ||
                decision === 'timeout' ||
                decision === 'reviewer_denied' ||
                decision === 'cancelled_after_denial')
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

export function isToolApprovalRequestInput(message: AgentMessage): boolean {
    return message.type === AgentMessageType.REQUEST_INPUT && getToolApprovalKey(message) !== undefined;
}

function isToolApprovalOptionResponse(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.QUESTION) return false;
    const normalized = getAgentMessageText(message).trim().toLowerCase();
    return normalized === 'allow_once' || normalized === 'allow_for_run' || normalized === 'deny';
}

function isToolApprovalMetadataResponse(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.QUESTION) return false;
    const details = getRecord(message.details);
    const metadata = getRecord(details?.metadata);
    const toolApprovalResponse =
        getRecord(details?.tool_approval_response) ?? getRecord(metadata?.tool_approval_response);
    return toolApprovalResponse?.decision === 'deny_with_feedback';
}

function isToolApprovalResponse(message: AgentMessage): boolean {
    return isToolApprovalOptionResponse(message) || isToolApprovalMetadataResponse(message);
}

export function isRequestInputResolvedByToolApprovalEvent(
    message: AgentMessage,
    resolvedToolApprovalKeys: Set<string>,
): boolean {
    if (message.type !== AgentMessageType.REQUEST_INPUT) return false;
    const approvalKey = getToolApprovalKey(message);
    return approvalKey ? resolvedToolApprovalKeys.has(approvalKey) : false;
}

export function getAnsweredToolApprovalRequestInputKeys(messages: AgentMessage[]): Set<string> {
    const answered = new Set<string>();

    messages.forEach((message, index) => {
        if (!isToolApprovalRequestInput(message)) return;

        const workstreamId = getWorkstreamId(message);
        for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
            const nextMessage = messages[nextIndex];
            if (getWorkstreamId(nextMessage) !== workstreamId) continue;
            if (nextMessage.type === AgentMessageType.REQUEST_INPUT) break;
            if (nextMessage.type === AgentMessageType.QUESTION) {
                if (isToolApprovalResponse(nextMessage)) {
                    answered.add(getRequestInputMessageKey(message));
                }
                break;
            }
        }
    });

    return answered;
}

export function isToolApprovalRequestInputHidden(
    message: AgentMessage,
    answeredToolApprovalRequestInputKeys: Set<string>,
    resolvedToolApprovalKeys: Set<string>,
): boolean {
    return (
        isToolApprovalRequestInput(message) &&
        (answeredToolApprovalRequestInputKeys.has(getRequestInputMessageKey(message)) ||
            isRequestInputResolvedByToolApprovalEvent(message, resolvedToolApprovalKeys))
    );
}

export function getHiddenToolApprovalAnswerKeys(
    messages: AgentMessage[],
    resolvedToolApprovalKeys?: Set<string>,
): Set<string> {
    const hidden = new Set<string>();

    messages.forEach((message, index) => {
        if (
            !isToolApprovalRequestInput(message) ||
            (resolvedToolApprovalKeys && !isRequestInputResolvedByToolApprovalEvent(message, resolvedToolApprovalKeys))
        ) {
            return;
        }

        const workstreamId = getWorkstreamId(message);
        for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
            const nextMessage = messages[nextIndex];
            if (getWorkstreamId(nextMessage) !== workstreamId) continue;
            if (nextMessage.type === AgentMessageType.REQUEST_INPUT) break;
            if (nextMessage.type === AgentMessageType.QUESTION) {
                if (isToolApprovalOptionResponse(nextMessage)) {
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
