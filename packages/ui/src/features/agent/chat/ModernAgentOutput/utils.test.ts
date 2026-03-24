import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { describe, expect, it } from "vitest";
import { getSlidingViewMessageBuckets, groupMessagesWithStreaming, isToolActivityMessage, mergeConsecutiveToolGroups, shouldCollapseAdjacentRenderedMessage } from "./utils";

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

describe("ModernAgentOutput utils - sliding view thinking", () => {
    it("does not surface stale thinking after newer important messages", () => {
        const thinking = makeMessage({
            timestamp: 1000,
            message: "Now let me update the benchmark doc, then launch all workstreams.",
            type: AgentMessageType.THOUGHT,
        });
        const answer = makeMessage({
            timestamp: 2000,
            message: "All 10 workstreams are now running.",
            type: AgentMessageType.ANSWER,
        });

        const result = getSlidingViewMessageBuckets([thinking, answer], false, false);

        expect(result.importantMessages).toEqual([answer]);
        expect(result.recentThinking).toEqual([]);
    });

    it("keeps the newest thinking when nothing more important has happened yet", () => {
        const question = makeMessage({
            timestamp: 1000,
            message: "Start the benchmark.",
            type: AgentMessageType.QUESTION,
        });
        const thinking = makeMessage({
            timestamp: 2000,
            message: "Launching the workstreams now.",
            type: AgentMessageType.THOUGHT,
        });

        const result = getSlidingViewMessageBuckets([question, thinking], false, false);

        expect(result.importantMessages).toEqual([question]);
        expect(result.recentThinking).toEqual([thinking]);
    });
});

describe("ModernAgentOutput utils - streamed deduplication", () => {
    it("skips a stale streaming item once an equivalent streamed answer is persisted", () => {
        const answer = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.ANSWER,
            message: "Here is the final synthesis.",
            details: {
                streamed: true,
            },
        });

        const grouped = groupMessagesWithStreaming(
            [answer],
            new Map([
                ["stream-1", {
                    text: "Here is the final synthesis.",
                    startTimestamp: 1000,
                    workstreamId: "main",
                }],
            ]),
        );

        expect(grouped).toHaveLength(1);
        expect(grouped[0].type).toBe("single");
    });

    it("skips a stale streaming item when the persisted message matches by activity id", () => {
        const answer = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.ANSWER,
            message: "Different final text",
            details: {
                activity_id: "activity-1",
            },
        });

        const grouped = groupMessagesWithStreaming(
            [answer],
            new Map([
                ["activity-1", {
                    text: "partial text",
                    startTimestamp: 1000,
                    workstreamId: "main",
                    activityId: "activity-1",
                }],
            ]),
        );

        expect(grouped).toHaveLength(1);
        expect(grouped[0].type).toBe("single");
    });
});

describe("ModernAgentOutput utils - adjacent rendered deduplication", () => {
    it("collapses adjacent answer and complete messages with the same text", () => {
        const previous = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.ANSWER,
            message: "Final answer",
            workstream_id: "main",
        });
        const current = makeMessage({
            timestamp: 1500,
            type: AgentMessageType.COMPLETE,
            message: "Final answer",
            workstream_id: "main",
        });

        expect(shouldCollapseAdjacentRenderedMessage(previous, current)).toBe(true);
    });

    it("collapses adjacent streamed thought and answer messages with the same text", () => {
        const previous = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: "Synthesizing results",
            workstream_id: "roundtable",
            details: {
                streamed: true,
            },
        });
        const current = makeMessage({
            timestamp: 1200,
            type: AgentMessageType.ANSWER,
            message: "Synthesizing results",
            workstream_id: "roundtable",
            details: {
                streamed: true,
            },
        });

        expect(shouldCollapseAdjacentRenderedMessage(previous, current)).toBe(true);
    });

    it("keeps repeated content when it is from a different workstream", () => {
        const previous = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.ANSWER,
            message: "Same text",
            workstream_id: "alpha",
        });
        const current = makeMessage({
            timestamp: 1200,
            type: AgentMessageType.COMPLETE,
            message: "Same text",
            workstream_id: "beta",
        });

        expect(shouldCollapseAdjacentRenderedMessage(previous, current)).toBe(false);
    });
});
