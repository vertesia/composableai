import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { describe, expect, it } from "vitest";
import { groupMessagesWithStreaming, isToolActivityMessage, mergeConsecutiveToolGroups } from "./utils";

function makeMessage(overrides: Partial<AgentMessage>): AgentMessage {
    return {
        timestamp: 0,
        workflow_run_id: "run-1",
        type: AgentMessageType.THOUGHT,
        message: "",
        ...overrides,
    };
}

describe("ModernAgentOutput utils - tool preamble behavior", () => {
    it("treats tool preamble thoughts as tool activity", () => {
        const preamble = makeMessage({
            message: "I will now call tools",
            details: {
                display_role: "tool_preamble",
                tools: ["search_documents"],
            },
        });

        expect(isToolActivityMessage(preamble)).toBe(true);
    });

    it("groups a single tool preamble into a tool_group (not a standalone message)", () => {
        const preamble = makeMessage({
            timestamp: 1000,
            message: "I will now call tools",
            details: {
                display_role: "tool_preamble",
                tools: ["search_documents"],
            },
        });

        const grouped = mergeConsecutiveToolGroups(groupMessagesWithStreaming([preamble], new Map()));

        expect(grouped).toHaveLength(1);
        expect(grouped[0].type).toBe("tool_group");
        if (grouped[0].type === "tool_group") {
            expect(grouped[0].messages).toHaveLength(1);
            expect(grouped[0].messages[0].details?.display_role).toBe("tool_preamble");
        }
    });

    it("keeps preamble and tool-call thought in the same activity tool group", () => {
        const activityGroupId = "activity-1";
        const preamble = makeMessage({
            timestamp: 1000,
            message: "Let me check available docs before answering.",
            details: {
                display_role: "tool_preamble",
                tools: ["list-assistant-knowledge"],
                activity_group_id: activityGroupId,
            },
        });
        const toolCall = makeMessage({
            timestamp: 1010,
            message: "Searching for all knowledge documents available",
            details: {
                tool: "list-assistant-knowledge",
                tool_status: "running",
                activity_group_id: activityGroupId,
            },
        });

        const grouped = mergeConsecutiveToolGroups(groupMessagesWithStreaming([preamble, toolCall], new Map()));

        expect(grouped).toHaveLength(1);
        expect(grouped[0].type).toBe("tool_group");
        if (grouped[0].type === "tool_group") {
            expect(grouped[0].messages).toHaveLength(2);
            expect(grouped[0].messages[0].details?.display_role).toBe("tool_preamble");
            expect(grouped[0].messages[1].details?.tool).toBe("list-assistant-knowledge");
        }
    });
});
