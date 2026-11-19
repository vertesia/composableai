import { type AgentMessage, AgentMessageType, type CompactMessage } from '@vertesia/common';

type MessageDetails = AgentMessage['details'] | CompactMessage['d'];

function readProcessRunId(details: MessageDetails): string | undefined {
    if (!details || typeof details !== 'object') {
        return undefined;
    }
    const value = (details as { process_run_id?: unknown }).process_run_id;
    return typeof value === 'string' ? value : undefined;
}

function isRootProcessMessage(details: MessageDetails, rootRunId: string): boolean {
    const processRunId = readProcessRunId(details);
    return !processRunId || processRunId === rootRunId;
}

/**
 * Only the main workstream's COMPLETE or TERMINATED ends the run (and IDLE when `closeOnIdle` is set).
 * Sub-agents publish their own COMPLETE and TERMINATED on the parent's channel under their own
 * workstream id, and child process runs publish theirs with a different `process_run_id`; neither
 * ends the root run.
 */
function isRunEndType(type: AgentMessageType, closeOnIdle: boolean): boolean {
    return (
        type === AgentMessageType.COMPLETE ||
        type === AgentMessageType.TERMINATED ||
        (closeOnIdle && type === AgentMessageType.IDLE)
    );
}

export function shouldCloseAgentRunStream(message: AgentMessage, rootRunId: string, closeOnIdle = false): boolean {
    return (
        isRunEndType(message.type, closeOnIdle) &&
        (message.workstream_id ?? 'main') === 'main' &&
        isRootProcessMessage(message.details, rootRunId)
    );
}

export function shouldCloseCompactRunStream(message: CompactMessage, rootRunId: string, closeOnIdle = false): boolean {
    return (
        isRunEndType(message.t, closeOnIdle) &&
        (message.w ?? 'main') === 'main' &&
        isRootProcessMessage(message.d, rootRunId)
    );
}
