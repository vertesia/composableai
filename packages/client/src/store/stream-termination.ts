import { AgentMessage, AgentMessageType, CompactMessage } from "@vertesia/common";

type MessageDetails = AgentMessage["details"] | CompactMessage["d"];

function readProcessRunId(details: MessageDetails): string | undefined {
    if (!details || typeof details !== "object") {
        return undefined;
    }
    const value = (details as { process_run_id?: unknown }).process_run_id;
    return typeof value === "string" ? value : undefined;
}

function isRootProcessMessage(details: MessageDetails, rootRunId: string): boolean {
    const processRunId = readProcessRunId(details);
    return !processRunId || processRunId === rootRunId;
}

export function shouldCloseAgentRunStream(message: AgentMessage, rootRunId: string): boolean {
    if (message.type === AgentMessageType.TERMINATED) {
        return isRootProcessMessage(message.details, rootRunId);
    }

    if (message.type === AgentMessageType.COMPLETE && (message.workstream_id ?? "main") === "main") {
        return isRootProcessMessage(message.details, rootRunId);
    }

    return false;
}

export function shouldCloseCompactRunStream(message: CompactMessage, rootRunId: string): boolean {
    if (message.t === AgentMessageType.TERMINATED) {
        return isRootProcessMessage(message.d, rootRunId);
    }

    if (message.t === AgentMessageType.COMPLETE && (message.w ?? "main") === "main") {
        return isRootProcessMessage(message.d, rootRunId);
    }

    return false;
}
