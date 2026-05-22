import { AgentMessageType, type AgentMessage, type CompactMessage } from "@vertesia/common";
import { describe, expect, it } from "vitest";
import { shouldCloseAgentRunStream, shouldCloseCompactRunStream } from "./stream-termination.js";

describe("stream termination", () => {
    const rootRunId = "root-run";

    it("closes agent streams on the root run completion", () => {
        const message: AgentMessage = {
            type: AgentMessageType.COMPLETE,
            timestamp: Date.now(),
            workflow_run_id: rootRunId,
            message: "root complete",
            workstream_id: "main",
            details: {
                process_run_id: rootRunId,
            },
        };

        expect(shouldCloseAgentRunStream(message, rootRunId)).toBe(true);
    });

    it("keeps agent streams open for child process completion on main", () => {
        const message: AgentMessage = {
            type: AgentMessageType.COMPLETE,
            timestamp: Date.now(),
            workflow_run_id: rootRunId,
            message: "child complete",
            workstream_id: "main",
            details: {
                process_run_id: "child-run",
            },
        };

        expect(shouldCloseAgentRunStream(message, rootRunId)).toBe(false);
    });

    it("keeps compact streams open for child process completion on main", () => {
        const message: CompactMessage = {
            t: AgentMessageType.COMPLETE,
            m: "child complete",
            d: {
                process_run_id: "child-run",
            },
        };

        expect(shouldCloseCompactRunStream(message, rootRunId)).toBe(false);
    });

    it("still closes streams for main completion without process metadata", () => {
        const message: CompactMessage = {
            t: AgentMessageType.COMPLETE,
            m: "conversation complete",
        };

        expect(shouldCloseCompactRunStream(message, rootRunId)).toBe(true);
    });
});
