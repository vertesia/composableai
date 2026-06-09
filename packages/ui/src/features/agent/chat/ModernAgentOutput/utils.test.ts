import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    buildSummaryConversationItems,
    buildSummaryDisplayMessages,
    getSummaryActivityAnchorTimestamp,
    getSummaryConversationLatestTimestamp,
    isInitialSummaryActivityFallback,
    shouldShowSummaryActivityFallback,
} from './SummaryConversation';
import {
    getSlidingViewMessageBuckets,
    groupMessagesWithStreaming,
    isInProgress,
    isStreamReplacedByMessage,
    isToolActivityMessage,
    mergeConsecutiveToolGroups,
    shouldCollapseAdjacentRenderedMessage,
} from './utils';

function makeMessage(overrides: Partial<AgentMessage>): AgentMessage {
    return {
        timestamp: 0,
        workflow_run_id: 'run-1',
        type: AgentMessageType.THOUGHT,
        message: '',
        ...overrides,
    };
}

describe('ModernAgentOutput utils - tool preamble behavior', () => {
    it('treats tool preamble thoughts as standalone turn prose', () => {
        const preamble = makeMessage({
            message: 'I will now call tools',
            details: {
                display_role: 'tool_preamble',
                tools: ['search_documents'],
            },
        });

        expect(isToolActivityMessage(preamble)).toBe(false);
    });

    it('treats legacy think tool rows as standalone preamble prose', () => {
        const preamble = makeMessage({
            message: 'Thinking about how to get the news headlines for Tokyo.',
            details: {
                event_class: 'activity',
                tool: 'think',
                tool_run_id: 'tool-1',
                tool_use_id: 'tool-1',
                tool_status: 'running',
                tool_event: 'started',
                activity_group_id: 'activity-1',
                message_to_human: 'Thinking about how to get the news headlines for Tokyo.',
            },
        });

        expect(isToolActivityMessage(preamble)).toBe(false);
    });

    it('keeps a single tool preamble as a standalone message', () => {
        const preamble = makeMessage({
            timestamp: 1000,
            message: 'I will now call tools',
            details: {
                display_role: 'tool_preamble',
                tools: ['search_documents'],
            },
        });

        const grouped = mergeConsecutiveToolGroups(groupMessagesWithStreaming([preamble], new Map()));

        expect(grouped).toHaveLength(1);
        expect(grouped[0].type).toBe('single');
        if (grouped[0].type === 'single') {
            expect(grouped[0].message.details?.display_role).toBe('tool_preamble');
        }
    });

    it('keeps a legacy think tool row as a standalone message', () => {
        const preamble = makeMessage({
            timestamp: 1000,
            message: 'Thinking about how to get the news headlines for Tokyo.',
            details: {
                event_class: 'activity',
                tool: 'think',
                tool_run_id: 'tool-1',
                tool_use_id: 'tool-1',
                tool_status: 'running',
                tool_event: 'started',
                activity_group_id: 'activity-1',
                message_to_human: 'Thinking about how to get the news headlines for Tokyo.',
            },
        });

        const grouped = mergeConsecutiveToolGroups(groupMessagesWithStreaming([preamble], new Map()));

        expect(grouped).toHaveLength(1);
        expect(grouped[0].type).toBe('single');
        if (grouped[0].type === 'single') {
            expect(grouped[0].message.details?.tool).toBe('think');
        }
    });

    it('keeps preamble separate from the following activity tool group', () => {
        const activityGroupId = 'activity-1';
        const preamble = makeMessage({
            timestamp: 1000,
            message: 'Let me check available docs before answering.',
            details: {
                display_role: 'tool_preamble',
                tools: ['list-assistant-knowledge'],
                activity_group_id: activityGroupId,
            },
        });
        const toolCall = makeMessage({
            timestamp: 1010,
            message: 'Searching for all knowledge documents available',
            details: {
                tool: 'list-assistant-knowledge',
                tool_status: 'running',
                activity_group_id: activityGroupId,
            },
        });

        const grouped = mergeConsecutiveToolGroups(groupMessagesWithStreaming([preamble, toolCall], new Map()));

        expect(grouped).toHaveLength(2);
        expect(grouped[0].type).toBe('single');
        if (grouped[0].type === 'single') {
            expect(grouped[0].message.details?.display_role).toBe('tool_preamble');
        }
        expect(grouped[1].type).toBe('tool_group');
        if (grouped[1].type === 'tool_group') {
            expect(grouped[1].messages).toHaveLength(1);
            expect(grouped[1].messages[0].details?.tool).toBe('list-assistant-knowledge');
        }
    });
});

describe('ModernAgentOutput utils - progress state', () => {
    it('treats a new user turn after an older idle message as in progress', () => {
        const idle = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.IDLE,
            message: 'Waiting for your command...',
        });
        const question = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.QUESTION,
            message: 'Look that up too.',
        });

        expect(isInProgress([idle, question])).toBe(true);
    });
});

describe('ModernAgentOutput utils - sliding view thinking', () => {
    it('does not surface stale thinking after newer important messages', () => {
        const thinking = makeMessage({
            timestamp: 1000,
            message: 'Now let me update the benchmark doc, then launch all workstreams.',
            type: AgentMessageType.THOUGHT,
        });
        const answer = makeMessage({
            timestamp: 2000,
            message: 'All 10 workstreams are now running.',
            type: AgentMessageType.ANSWER,
        });

        const result = getSlidingViewMessageBuckets([thinking, answer], false, false);

        expect(result.importantMessages).toEqual([answer]);
        expect(result.recentThinking).toEqual([]);
    });

    it('keeps recent thinking when nothing more important has happened yet', () => {
        const question = makeMessage({
            timestamp: 1000,
            message: 'Start the benchmark.',
            type: AgentMessageType.QUESTION,
        });
        const thinking = makeMessage({
            timestamp: 2000,
            message: 'Launching the workstreams now.',
            type: AgentMessageType.THOUGHT,
        });

        const result = getSlidingViewMessageBuckets([question, thinking], false, false);

        expect(result.importantMessages).toEqual([question]);
        expect(result.recentThinking).toEqual([thinking]);
    });

    it('keeps the current thinking trace instead of only the latest item', () => {
        const question = makeMessage({
            timestamp: 1000,
            message: 'Start the benchmark.',
            type: AgentMessageType.QUESTION,
        });
        const firstThinking = makeMessage({
            timestamp: 2000,
            message: 'Planning the work.',
            type: AgentMessageType.THOUGHT,
        });
        const secondThinking = makeMessage({
            timestamp: 3000,
            message: 'Launching the workstreams now.',
            type: AgentMessageType.UPDATE,
        });

        const result = getSlidingViewMessageBuckets([question, firstThinking, secondThinking], false, false);

        expect(result.importantMessages).toEqual([question]);
        expect(result.recentThinking).toEqual([firstThinking, secondThinking]);
    });

    it('hides completed tool activity from the summary bucket', () => {
        const user = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find headlines',
        });
        const completedTool = makeMessage({
            timestamp: 1500,
            type: AgentMessageType.THOUGHT,
            message: 'Searched the web',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
            },
        });
        const answer = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.ANSWER,
            message: 'Here are the headlines.',
        });

        const result = getSlidingViewMessageBuckets([user, completedTool, answer], true, false);

        expect(result.importantMessages).toEqual([user, answer]);
    });

    it('keeps running, warning, and error tool activity visible in summary', () => {
        const runningTool = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching the web',
            details: {
                tool: 'web_search_serper',
                tool_status: 'running',
            },
        });
        const warningTool = makeMessage({
            timestamp: 1100,
            type: AgentMessageType.THOUGHT,
            message: 'Search returned partial results',
            details: {
                tool: 'web_search_serper',
                tool_status: 'warning',
            },
        });
        const errorTool = makeMessage({
            timestamp: 1200,
            type: AgentMessageType.THOUGHT,
            message: 'Search failed',
            details: {
                tool: 'web_search_serper',
                tool_status: 'error',
            },
        });

        const result = getSlidingViewMessageBuckets([runningTool, warningTool, errorTool], false, false);

        expect(result.importantMessages).toEqual([runningTool, warningTool, errorTool]);
    });

    it('hides stale running tool activity once a newer assistant answer exists', () => {
        const user = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find Japan news headlines',
        });
        const runningTool = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching the web',
            details: {
                tool: 'web_search_serper',
                tool_status: 'running',
            },
        });
        const answer = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.ANSWER,
            message: 'Here are the headlines.',
        });

        const result = getSlidingViewMessageBuckets([user, runningTool, answer], false, false);

        expect(result.importantMessages).toEqual([user, answer]);
    });

    it('keeps user, assistant, warnings, errors, and input requests in summary', () => {
        const user = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Start',
        });
        const answer = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.ANSWER,
            message: 'Done',
        });
        const warning = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.WARNING,
            message: 'Partial result',
        });
        const error = makeMessage({
            timestamp: 4000,
            type: AgentMessageType.ERROR,
            message: 'Failed',
        });
        const requestInput = makeMessage({
            timestamp: 5000,
            type: AgentMessageType.REQUEST_INPUT,
            message: 'Choose one',
        });

        const result = getSlidingViewMessageBuckets([user, answer, warning, error, requestInput], false, false);

        expect(result.importantMessages).toEqual([user, answer, warning, error, requestInput]);
    });
});

describe('ModernAgentOutput summary conversation items', () => {
    it('keeps streamed tool preambles between tool groups inside work details', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find Japan news.',
        });
        const firstTool = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching for Japan news',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });
        const assistantProse = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.THOUGHT,
            message: 'I found one angle; I will check foreign media coverage too.',
            details: {
                display_role: 'tool_preamble',
                tools: ['web_search_serper'],
                streamed: true,
            },
        });
        const secondTool = makeMessage({
            timestamp: 4000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching foreign media coverage',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-2',
            },
        });
        const answer = makeMessage({
            timestamp: 5000,
            type: AgentMessageType.ANSWER,
            message: 'Here is what I found.',
        });

        const items = buildSummaryConversationItems([question, firstTool, assistantProse, secondTool, answer], true);

        expect(items.map((item) => item.type)).toEqual(['message', 'work', 'message']);
        if (items[1].type !== 'work') {
            throw new Error('Expected tool preamble to stay inside the work row');
        }
        expect(items[1].messages).toEqual([firstTool, assistantProse, secondTool]);
    });

    it('keeps non-streamed tool preambles inside work details', () => {
        const preamble = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'I will call a search tool.',
            details: {
                display_role: 'tool_preamble',
                tools: ['web_search_serper'],
            },
        });
        const tool = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });

        const items = buildSummaryConversationItems([preamble, tool], true);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            type: 'work',
            messages: [preamble, tool],
        });
    });

    it('keeps recovered tool-scoped errors inside the surrounding work block', () => {
        const publishStart = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Preparing app publish for appgen-123',
            details: {
                activity_group_id: 'activity-10',
                tool: 'app_publish',
                tool_run_id: 'publish-run-1',
                tool_status: 'running',
            },
        });
        const publishError = makeMessage({
            timestamp: 1100,
            type: AgentMessageType.ERROR,
            message: 'App publish blocked until preview validation passes',
            details: {
                activity_group_id: 'activity-10',
                tool: 'app_publish',
                tool_run_id: 'publish-run-1',
                tool_status: 'error',
            },
        });
        const nextToolStart = makeMessage({
            timestamp: 1200,
            type: AgentMessageType.THOUGHT,
            message: 'Starting the dev server to get a live preview URL...',
            details: {
                activity_group_id: 'activity-11',
                tool: 'app_dev_server_start',
                tool_run_id: 'dev-server-run-1',
                tool_status: 'running',
            },
        });

        const items = buildSummaryConversationItems([publishStart, publishError, nextToolStart], false);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            type: 'work',
            isActive: true,
            status: 'running',
            messages: [publishStart, publishError, nextToolStart],
        });
    });

    it('marks an unresolved trailing tool-scoped error as needing attention', () => {
        const publishStart = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Preparing app publish for appgen-123',
            details: {
                activity_group_id: 'activity-10',
                tool: 'app_publish',
                tool_run_id: 'publish-run-1',
                tool_status: 'running',
            },
        });
        const publishError = makeMessage({
            timestamp: 1100,
            type: AgentMessageType.ERROR,
            message: 'App publish blocked until preview validation passes',
            details: {
                activity_group_id: 'activity-10',
                tool: 'app_publish',
                tool_run_id: 'publish-run-1',
                tool_status: 'error',
            },
        });

        const items = buildSummaryConversationItems([publishStart, publishError], false);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            type: 'work',
            isActive: true,
            status: 'error',
            messages: [publishStart, publishError],
        });
    });

    it('hides transient thinking once the work segment completes', () => {
        const tool = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });
        const thinking = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                display_role: 'thinking',
                activity_group_id: 'activity-1',
            },
        });
        const answer = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.ANSWER,
            message: 'Here is the answer.',
        });

        const items = buildSummaryConversationItems([tool, thinking, answer], true);

        expect(items[0]).toMatchObject({
            type: 'work',
            isActive: false,
            messages: [tool],
            endTimestamp: 3000,
        });
    });

    it('keeps completed tool work active while post-tool thinking is current', () => {
        const tool = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });
        const thinking = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                display_role: 'thinking',
                activity_group_id: 'activity-1',
            },
        });

        const items = buildSummaryConversationItems([tool, thinking], false);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            type: 'work',
            isActive: true,
            messages: [tool, thinking],
        });
    });

    it('hides stale thinking when another tool event follows it', () => {
        const firstTool = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });
        const thinking = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                display_role: 'thinking',
                activity_group_id: 'activity-1',
            },
        });
        const secondTool = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching again',
            details: {
                tool: 'web_search_serper',
                tool_status: 'running',
                tool_run_id: 'tool-2',
            },
        });

        const items = buildSummaryConversationItems([firstTool, thinking, secondTool], false);

        expect(items[0]).toMatchObject({
            type: 'work',
            messages: [firstTool, secondTool],
        });
    });

    it('hides transient thinking when a later streaming message is observed', () => {
        const tool = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });
        const thinking = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                display_role: 'thinking',
                activity_group_id: 'activity-1',
            },
        });

        const items = buildSummaryConversationItems([tool, thinking], false, 3000);

        expect(items[0]).toMatchObject({
            type: 'work',
            messages: [tool],
        });
    });

    it('hides transient thinking while live assistant text is streaming', () => {
        const tool = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });
        const thinking = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                display_role: 'thinking',
                activity_group_id: 'activity-1',
            },
        });

        const items = buildSummaryConversationItems([tool, thinking], false, Number.POSITIVE_INFINITY);

        expect(items[0]).toMatchObject({
            type: 'work',
            messages: [tool],
        });
    });

    it('does not turn an idle message into a completed transient thinking row', () => {
        const thinking = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                display_role: 'thinking',
                activity_group_id: 'activity-1',
            },
        });
        const idle = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.IDLE,
            message: 'Waiting for your command...',
            details: {
                event_class: 'activity',
            },
        });

        const items = buildSummaryConversationItems([thinking, idle], true);

        expect(items).toEqual([]);
    });

    it('closes pending work when an idle marker arrives even if parent completion lags', () => {
        const tool = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching for current headlines',
            details: {
                tool: 'web_search_serper',
                tool_status: 'running',
                tool_run_id: 'tool-1',
                activity_group_id: 'activity-1',
            },
        });
        const idle = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.IDLE,
            message: 'Waiting for your command...',
            details: {
                event_class: 'activity',
            },
        });

        const items = buildSummaryConversationItems([tool, idle], false);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            type: 'work',
            isActive: false,
            status: 'completed',
            messages: [tool],
            endTimestamp: 2000,
        });
    });

    it('hides transient thinking when a later ignored message is persisted', () => {
        const tool = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });
        const thinking = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                display_role: 'thinking',
                activity_group_id: 'activity-1',
            },
        });
        const chunk = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.STREAMING_CHUNK,
            message: 'partial answer',
        });

        const items = buildSummaryConversationItems([tool, thinking, chunk], false);

        expect(items[0]).toMatchObject({
            type: 'work',
            messages: [tool],
        });
    });

    it('keeps activity fallback anchored to the latest visible summary item', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find local news.',
        });
        const hiddenSystemMessage = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.SYSTEM,
            message: 'Ops ready',
            details: {
                system_type: 'toolkit_ready',
            },
        });

        const items = buildSummaryConversationItems([question, hiddenSystemMessage], false);

        expect(getSummaryConversationLatestTimestamp(items, 500)).toBe(1000);
    });

    it('keeps the latest visible work row active when tool work just completed', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find local news.',
        });
        const runningTool = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                tool: 'web_search_serper',
                tool_status: 'running',
                tool_run_id: 'tool-1',
            },
        });
        const completedTool = makeMessage({
            timestamp: 2500,
            type: AgentMessageType.THOUGHT,
            message: 'Found results',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });

        const items = buildSummaryConversationItems([question, runningTool, completedTool], false);

        expect(items[1]).toMatchObject({
            type: 'work',
            isActive: true,
        });
        expect(getSummaryConversationLatestTimestamp(items, 500)).toBe(2500);
    });

    it('anchors activity fallback to the earliest persisted message when summary has no visible items', () => {
        const toolkitReady = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.SYSTEM,
            message: 'Ops ready',
            details: {
                system_type: 'toolkit_ready',
            },
        });
        const hiddenThinking = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                display_role: 'thinking',
            },
        });

        const items = buildSummaryConversationItems([toolkitReady, hiddenThinking], false, 4000);

        expect(items).toEqual([]);
        expect(getSummaryActivityAnchorTimestamp(items, [toolkitReady, hiddenThinking], 500)).toBe(1000);
    });

    it('uses the latest visible summary item before falling back to hidden messages', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find local news.',
        });
        const hiddenSystemMessage = makeMessage({
            timestamp: 5000,
            type: AgentMessageType.SYSTEM,
            message: 'Ops ready',
            details: {
                system_type: 'toolkit_ready',
            },
        });

        const items = buildSummaryConversationItems([question, hiddenSystemMessage], false);

        expect(getSummaryActivityAnchorTimestamp(items, [question, hiddenSystemMessage], 500)).toBe(1000);
    });

    it('shows activity fallback while a user turn is waiting for first activity', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find local news.',
        });

        const items = buildSummaryConversationItems([question], false);

        expect(shouldShowSummaryActivityFallback(items, true, false)).toBe(true);
        expect(isInitialSummaryActivityFallback(items)).toBe(true);
    });

    it('does not show a standalone activity fallback before a visible prompt exists', () => {
        expect(shouldShowSummaryActivityFallback([], true, false)).toBe(false);
        expect(isInitialSummaryActivityFallback([])).toBe(false);
    });

    it('uses working fallback after a follow-up question in an existing conversation', () => {
        const firstQuestion = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find local news.',
        });
        const answer = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.ANSWER,
            message: 'Here are the headlines.',
        });
        const followUpQuestion = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.QUESTION,
            message: 'Tell me more.',
        });

        const items = buildSummaryConversationItems([firstQuestion, answer, followUpQuestion], false);

        expect(shouldShowSummaryActivityFallback(items, true, false)).toBe(true);
        expect(isInitialSummaryActivityFallback(items)).toBe(false);
    });

    it('does not flicker activity fallback after the assistant answer arrives before idle', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find local news.',
        });
        const tool = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });
        const answer = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.ANSWER,
            message: 'Here are the headlines.',
            details: {
                streamed: true,
            },
        });

        const items = buildSummaryConversationItems([question, tool, answer], false);

        expect(items.map((item) => item.type)).toEqual(['message', 'work', 'message']);
        expect(shouldShowSummaryActivityFallback(items, true, false)).toBe(false);
    });

    it('does not show activity fallback while assistant text is streaming', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'Find local news.',
        });

        const items = buildSummaryConversationItems([question], false);

        expect(shouldShowSummaryActivityFallback(items, true, true)).toBe(false);
    });

    it('keeps unreplaced completed pre-tool streaming prose inside the following work row', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'What does Les Echos say?',
        });
        const tool = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching for Les Echos via Serper...',
            details: {
                activity_group_id: 'activity-1',
                tool: 'web_search_serper',
                tool_status: 'running',
                tool_run_id: 'tool-1',
            },
        });

        const summaryMessages = buildSummaryDisplayMessages(
            [question, tool],
            new Map([
                [
                    'activity-1',
                    {
                        text: 'I will now search for "Les Echos" to see what they are reporting.',
                        startTimestamp: 2000,
                        activityId: 'activity-1',
                        isComplete: true,
                    },
                ],
            ]),
        );
        const items = buildSummaryConversationItems(summaryMessages, false);

        expect(items.map((item) => item.type)).toEqual(['message', 'work']);
        if (items[1].type !== 'work') {
            throw new Error('Expected streaming preamble to be grouped into the work row');
        }
        expect(items[1].messages).toMatchObject([
            {
                type: AgentMessageType.THOUGHT,
                message: 'I will now search for "Les Echos" to see what they are reporting.',
                details: {
                    display_role: 'tool_preamble',
                    tools: ['web_search_serper'],
                },
            },
            tool,
        ]);
    });

    it('resolves completed pre-tool streams through transient thinking activity groups', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'What are the news headlines in Japan today?',
        });
        const tool = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching for Japan news headlines via Serper...',
            details: {
                activity_group_id: 'activity-10',
                tool: 'web_search_serper',
                tool_status: 'completed',
                tool_run_id: 'tool-1',
            },
        });
        const thinkingMarker = makeMessage({
            timestamp: 4000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                activity_id: 'thinking-10',
                activity_group_id: 'activity-10',
                display_role: 'thinking',
            },
        });

        const summaryMessages = buildSummaryDisplayMessages(
            [question, tool, thinkingMarker],
            new Map([
                [
                    'thinking-10',
                    {
                        text: 'I will now perform a web search to retrieve the latest news headlines.',
                        startTimestamp: 2000,
                        activityId: 'thinking-10',
                        isComplete: true,
                    },
                ],
            ]),
        );
        const streamedPreamble = summaryMessages.find(
            (message) => message.message === 'I will now perform a web search to retrieve the latest news headlines.',
        );

        expect(streamedPreamble).toMatchObject({
            type: AgentMessageType.THOUGHT,
            details: {
                activity_group_id: 'activity-10',
                display_role: 'tool_preamble',
                tools: ['web_search_serper'],
            },
        });

        const items = buildSummaryConversationItems(summaryMessages, true);

        expect(items.map((item) => item.type)).toEqual(['message', 'work']);
        if (items[1].type !== 'work') {
            throw new Error('Expected bridged streaming preamble to be grouped into the work row');
        }
        expect(items[1].messages).toEqual([streamedPreamble, tool]);
    });

    it('does not duplicate completed streaming prose once persisted prose replaces it', () => {
        const answer = makeMessage({
            timestamp: 3000,
            type: AgentMessageType.ANSWER,
            message: 'Here are the headlines.',
            details: {
                activity_id: 'activity-1',
                streamed: true,
            },
        });

        const summaryMessages = buildSummaryDisplayMessages(
            [answer],
            new Map([
                [
                    'activity-1',
                    {
                        text: 'Here are the headlines.',
                        startTimestamp: 2000,
                        activityId: 'activity-1',
                        isComplete: true,
                    },
                ],
            ]),
        );

        expect(summaryMessages).toEqual([answer]);
    });

    it('keeps completed answer streams as assistant prose when a later tool message follows', () => {
        const question = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.QUESTION,
            message: 'What are the news headlines in Tokyo today?',
        });
        const thinkingMarker = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Thinking...',
            details: {
                display_role: 'thinking',
                activity_id: 'reply-1',
            },
        });
        const updatePlan = makeMessage({
            timestamp: 4000,
            type: AgentMessageType.THOUGHT,
            message: 'I have extracted the relevant news headlines and presented them.',
            details: {
                tool: 'update_plan',
                tool_status: 'running',
                tool_run_id: 'tool-1',
            },
        });

        const summaryMessages = buildSummaryDisplayMessages(
            [question, thinkingMarker, updatePlan],
            new Map([
                [
                    'reply-1',
                    {
                        text: 'Here are some of the top news headlines related to Tokyo today.',
                        startTimestamp: 3000,
                        activityId: 'reply-1',
                        isComplete: true,
                    },
                ],
            ]),
        );

        const streamedAnswer = summaryMessages.find(
            (message) => message.message === 'Here are some of the top news headlines related to Tokyo today.',
        );
        expect(streamedAnswer?.type).toBe(AgentMessageType.ANSWER);
        expect(streamedAnswer?.details?.display_role).toBeUndefined();
    });
});

describe('ModernAgentOutput utils - streamed deduplication', () => {
    it('skips a stale streaming item once an equivalent streamed answer is persisted', () => {
        const answer = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.ANSWER,
            message: 'Here is the final synthesis.',
            details: {
                streamed: true,
            },
        });

        const grouped = groupMessagesWithStreaming(
            [answer],
            new Map([
                [
                    'stream-1',
                    {
                        text: 'Here is the final synthesis.',
                        startTimestamp: 1000,
                        workstreamId: 'main',
                    },
                ],
            ]),
        );

        expect(grouped).toHaveLength(1);
        expect(grouped[0].type).toBe('single');
    });

    it('skips a stale streaming item when the persisted message matches by activity id', () => {
        const answer = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.ANSWER,
            message: 'Different final text',
            details: {
                activity_id: 'activity-1',
            },
        });

        const grouped = groupMessagesWithStreaming(
            [answer],
            new Map([
                [
                    'activity-1',
                    {
                        text: 'partial text',
                        startTimestamp: 1000,
                        workstreamId: 'main',
                        activityId: 'activity-1',
                    },
                ],
            ]),
        );

        expect(grouped).toHaveLength(1);
        expect(grouped[0].type).toBe('single');
    });

    it('does not treat a tool event with the same activity id as a replacement for streamed prose', () => {
        const tool = makeMessage({
            timestamp: 2000,
            type: AgentMessageType.THOUGHT,
            message: 'Searching',
            details: {
                activity_id: 'activity-1',
                tool: 'web_search_serper',
                tool_status: 'running',
                tool_run_id: 'tool-1',
            },
        });

        expect(
            isStreamReplacedByMessage(
                {
                    text: 'I will search first.',
                    startTimestamp: 1000,
                    activityId: 'activity-1',
                },
                [tool],
            ),
        ).toBe(false);
    });
});

describe('ModernAgentOutput utils - adjacent rendered deduplication', () => {
    it('collapses adjacent answer and complete messages with the same text', () => {
        const previous = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.ANSWER,
            message: 'Final answer',
            workstream_id: 'main',
        });
        const current = makeMessage({
            timestamp: 1500,
            type: AgentMessageType.COMPLETE,
            message: 'Final answer',
            workstream_id: 'main',
        });

        expect(shouldCollapseAdjacentRenderedMessage(previous, current)).toBe(true);
    });

    it('collapses adjacent streamed thought and answer messages with the same text', () => {
        const previous = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.THOUGHT,
            message: 'Synthesizing results',
            workstream_id: 'roundtable',
            details: {
                streamed: true,
            },
        });
        const current = makeMessage({
            timestamp: 1200,
            type: AgentMessageType.ANSWER,
            message: 'Synthesizing results',
            workstream_id: 'roundtable',
            details: {
                streamed: true,
            },
        });

        expect(shouldCollapseAdjacentRenderedMessage(previous, current)).toBe(true);
    });

    it('keeps repeated content when it is from a different workstream', () => {
        const previous = makeMessage({
            timestamp: 1000,
            type: AgentMessageType.ANSWER,
            message: 'Same text',
            workstream_id: 'alpha',
        });
        const current = makeMessage({
            timestamp: 1200,
            type: AgentMessageType.COMPLETE,
            message: 'Same text',
            workstream_id: 'beta',
        });

        expect(shouldCollapseAdjacentRenderedMessage(previous, current)).toBe(false);
    });
});
