import { type AgentMessage, AgentMessageType } from '@vertesia/common';

export type AgentChatPlaybackCursor = 'live' | number;

export interface AgentChatPlaybackState {
    cursor: AgentChatPlaybackCursor;
    cursorIndex: number;
    isLive: boolean;
    renderedMessageCount: number;
    displayedMessages: AgentMessage[];
}

export function clampPlaybackCursor(cursor: AgentChatPlaybackCursor, messageCount: number): AgentChatPlaybackCursor {
    if (cursor === 'live') return cursor;
    if (messageCount === 0) return 'live';
    return Math.min(Math.max(cursor, 0), messageCount - 1);
}

export function getPlaybackCursorIndex(cursor: AgentChatPlaybackCursor, messageCount: number): number {
    if (messageCount === 0) return -1;
    if (cursor === 'live') return messageCount - 1;
    return Math.min(Math.max(cursor, 0), messageCount - 1);
}

export function getPreviousUserTurnIndex(messages: AgentMessage[], cursor: AgentChatPlaybackCursor): number | null {
    if (messages.length === 0) return null;
    const currentIndex = cursor === 'live' ? messages.length : getPlaybackCursorIndex(cursor, messages.length);

    for (let index = Math.min(currentIndex - 1, messages.length - 1); index >= 0; index--) {
        if (messages[index].type === AgentMessageType.QUESTION) return index;
    }

    return null;
}

export function getNextUserTurnIndex(
    messages: AgentMessage[],
    cursor: AgentChatPlaybackCursor,
): number | 'live' | null {
    if (messages.length === 0 || cursor === 'live') return null;
    const currentIndex = getPlaybackCursorIndex(cursor, messages.length);

    for (let index = currentIndex + 1; index < messages.length; index++) {
        if (messages[index].type === AgentMessageType.QUESTION) return index;
    }

    return 'live';
}

export function createPlaybackState(
    messages: AgentMessage[],
    cursor: AgentChatPlaybackCursor,
    enabled: boolean,
): AgentChatPlaybackState {
    const clampedCursor = enabled ? clampPlaybackCursor(cursor, messages.length) : 'live';
    const cursorIndex = getPlaybackCursorIndex(clampedCursor, messages.length);
    const isLive = !enabled || clampedCursor === 'live';
    const displayedMessages = isLive ? messages : messages.slice(0, cursorIndex + 1);

    return {
        cursor: clampedCursor,
        cursorIndex,
        isLive,
        renderedMessageCount: displayedMessages.length,
        displayedMessages,
    };
}

function getHashSearchParams(hash: string): URLSearchParams {
    const queryStart = hash.indexOf('?');
    if (queryStart === -1) return new URLSearchParams();
    return new URLSearchParams(hash.slice(queryStart + 1));
}

export function isLocalhostAgentChatPlaybackAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local')
    );
}

export function isLocalhostAgentChatPlaybackEnabled(): boolean {
    if (!isLocalhostAgentChatPlaybackAvailable()) return false;

    const params = new URLSearchParams(window.location.search);
    const hashParams = getHashSearchParams(window.location.hash);
    const value = params.get('agentChatPlayback') ?? hashParams.get('agentChatPlayback');
    return value === '1' || value === 'true';
}
