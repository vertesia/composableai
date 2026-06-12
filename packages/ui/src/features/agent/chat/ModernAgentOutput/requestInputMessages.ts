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

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!hasRequestInputUx(message)) continue;
        if (getWorkstreamId(message) !== workstreamId) continue;
        if (isRequestInputAnswered(message, answeredRequestInputKeys)) continue;
        return message;
    }

    return undefined;
}
