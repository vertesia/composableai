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