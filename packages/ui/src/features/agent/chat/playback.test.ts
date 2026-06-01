import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    clampPlaybackCursor,
    createPlaybackState,
    getNextUserTurnIndex,
    getPlaybackCursorIndex,
    getPreviousUserTurnIndex,
    isLocalhostAgentChatPlaybackEnabled,
} from './playback';

function message(type: AgentMessageType, text: string): AgentMessage {
    return {
        timestamp: Date.now(),
        workflow_run_id: 'run-1',
        type,
        message: text,
        workstream_id: 'main',
    };
}

describe('agent chat playback helpers', () => {
    const messages = [
        message(AgentMessageType.QUESTION, 'first question'),
        message(AgentMessageType.ANSWER, 'first answer'),
        message(AgentMessageType.QUESTION, 'second question'),
        message(AgentMessageType.ANSWER, 'second answer'),
    ];

    it('clamps cursors and maps live to the latest message index', () => {
        expect(clampPlaybackCursor(-10, messages.length)).toBe(0);
        expect(clampPlaybackCursor(99, messages.length)).toBe(3);
        expect(clampPlaybackCursor('live', messages.length)).toBe('live');
        expect(clampPlaybackCursor(0, 0)).toBe('live');
        expect(getPlaybackCursorIndex('live', messages.length)).toBe(3);
        expect(getPlaybackCursorIndex('live', 0)).toBe(-1);
    });

    it('finds previous and next user turns from message and live cursors', () => {
        expect(getPreviousUserTurnIndex(messages, 'live')).toBe(2);
        expect(getPreviousUserTurnIndex(messages, 2)).toBe(0);
        expect(getPreviousUserTurnIndex(messages, 0)).toBeNull();
        expect(getNextUserTurnIndex(messages, 0)).toBe(2);
        expect(getNextUserTurnIndex(messages, 2)).toBe('live');
        expect(getNextUserTurnIndex(messages, 'live')).toBeNull();
    });

    it('builds a render-only message slice when playback is enabled', () => {
        const scrubbed = createPlaybackState(messages, 1, true);
        expect(scrubbed.isLive).toBe(false);
        expect(scrubbed.renderedMessageCount).toBe(2);
        expect(scrubbed.displayedMessages.map((item) => item.message)).toEqual(['first question', 'first answer']);

        const live = createPlaybackState(messages, 1, false);
        expect(live.cursor).toBe('live');
        expect(live.isLive).toBe(true);
        expect(live.displayedMessages).toBe(messages);
    });

    it('enables localhost playback from regular and hash-route query params', () => {
        window.history.pushState(null, '', '/store/agents/run-1?agentChatPlayback=1#conversation');
        expect(isLocalhostAgentChatPlaybackEnabled()).toBe(true);

        window.history.pushState(null, '', '/store/agents/run-1?p=project#conversation?agentChatPlayback=1');
        expect(isLocalhostAgentChatPlaybackEnabled()).toBe(true);

        window.history.pushState(null, '', '/store/agents/run-1?p=project#conversation');
        expect(isLocalhostAgentChatPlaybackEnabled()).toBe(false);
    });
});
