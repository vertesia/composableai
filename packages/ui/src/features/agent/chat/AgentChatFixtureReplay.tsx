import type { AgentMessage } from '@vertesia/common';
import { Button, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { DownloadCloudIcon, Pause, Play } from 'lucide-react';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgentChatPlaybackControls } from './AgentChatPlaybackControls';
import { AgentRequestInputOverlay } from './AgentRequestInputOverlay';
import AllMessagesMixed, { type AgentConversationViewMode } from './ModernAgentOutput/AllMessagesMixed';
import { getPendingRequestInputMessage } from './ModernAgentOutput/requestInputMessages';
import { isInProgress, type StreamingData } from './ModernAgentOutput/utils';
import {
    type AgentChatPlaybackCursor,
    clampPlaybackCursor,
    createPlaybackState,
    getPlaybackCursorIndex,
} from './playback';

export interface AgentChatReplayStreamingMessage extends StreamingData {
    id?: string;
}

export interface AgentChatReplayStreamingFrame {
    cursor: AgentChatPlaybackCursor;
    streamingMessages: AgentChatReplayStreamingMessage[];
}

export interface AgentChatReplayFixture {
    messages: AgentMessage[];
    streamingFrames?: AgentChatReplayStreamingFrame[];
    metadata?: {
        title?: string;
        agent_run_id?: string;
        exported_at?: string;
        message_count?: number;
    };
}

export interface AgentChatFixtureReplayProps {
    fixture: AgentChatReplayFixture;
    cursor?: AgentChatPlaybackCursor;
    initialCursor?: AgentChatPlaybackCursor;
    onCursorChange?: (cursor: AgentChatPlaybackCursor) => void;
    autoStepMs?: number;
    repeat?: number;
    viewMode?: AgentConversationViewMode;
    className?: string;
    title?: string;
}

function streamingFrameToMap(frame?: AgentChatReplayStreamingFrame): Map<string, StreamingData> {
    if (!frame) return new Map();
    return new Map(
        frame.streamingMessages.map((streamingMessage, index) => [
            streamingMessage.id ?? streamingMessage.activityId ?? `stream-${index}`,
            streamingMessage,
        ]),
    );
}

function findStreamingFrame(
    frames: AgentChatReplayStreamingFrame[] | undefined,
    cursor: AgentChatPlaybackCursor,
): AgentChatReplayStreamingFrame | undefined {
    return frames?.find((frame) => frame.cursor === cursor);
}

function getNextCursor(cursor: AgentChatPlaybackCursor, messageCount: number): AgentChatPlaybackCursor {
    if (messageCount === 0) return 'live';
    if (cursor === 'live') return 'live';
    const cursorIndex = getPlaybackCursorIndex(cursor, messageCount);
    return cursorIndex >= messageCount - 1 ? 'live' : cursorIndex + 1;
}

function sanitizeFilenamePart(value: string): string {
    return value
        .trim()
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function downloadJsonFile(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function AgentChatFixtureReplay({
    fixture,
    cursor: controlledCursor,
    initialCursor,
    onCursorChange,
    autoStepMs,
    repeat = 1,
    viewMode: controlledViewMode,
    className,
    title,
}: AgentChatFixtureReplayProps) {
    const { t } = useUITranslation();
    const messages = fixture.messages;
    const defaultCursor = initialCursor ?? (messages.length > 0 ? 0 : 'live');
    const [internalCursor, setInternalCursor] = useState<AgentChatPlaybackCursor>(() =>
        clampPlaybackCursor(defaultCursor, messages.length),
    );
    const cursor = controlledCursor ?? internalCursor;
    const viewMode = controlledViewMode ?? 'sliding';
    const [isPlaying, setIsPlaying] = useState(Boolean(autoStepMs));
    const [completedLoops, setCompletedLoops] = useState(0);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    const playback = useMemo(() => createPlaybackState(messages, cursor, true), [cursor, messages]);
    const displayedMessages = playback.displayedMessages;
    const streamingMessages = useMemo(
        () => streamingFrameToMap(findStreamingFrame(fixture.streamingFrames, playback.cursor)),
        [fixture.streamingFrames, playback.cursor],
    );

    const setCursor = useCallback(
        (nextCursor: AgentChatPlaybackCursor) => {
            const clampedCursor = clampPlaybackCursor(nextCursor, messages.length);
            if (controlledCursor === undefined) {
                setInternalCursor(clampedCursor);
            }
            onCursorChange?.(clampedCursor);
        },
        [controlledCursor, messages.length, onCursorChange],
    );

    useEffect(() => {
        const clampedCursor = clampPlaybackCursor(cursor, messages.length);
        if (clampedCursor !== cursor) setCursor(clampedCursor);
    }, [cursor, messages.length, setCursor]);

    useEffect(() => {
        if (!autoStepMs || autoStepMs <= 0 || !isPlaying) return;
        const intervalId = window.setInterval(() => {
            const nextCursor = getNextCursor(cursor, messages.length);
            if (nextCursor === 'live' && cursor === 'live') {
                setCompletedLoops((loops) => {
                    const nextLoops = loops + 1;
                    if (repeat > 0 && nextLoops >= repeat) {
                        setIsPlaying(false);
                        return nextLoops;
                    }
                    setCursor(messages.length > 0 ? 0 : 'live');
                    return nextLoops;
                });
                return;
            }
            setCursor(nextCursor);
        }, autoStepMs);
        return () => window.clearInterval(intervalId);
    }, [autoStepMs, cursor, isPlaying, messages.length, repeat, setCursor]);

    const isCompleted = displayedMessages.length > 0 && !isInProgress(displayedMessages);
    const pendingRequestInputMessage = useMemo(
        () => getPendingRequestInputMessage(displayedMessages),
        [displayedMessages],
    );
    const resolvedTitle = title ?? fixture.metadata?.title ?? t('agent.testPlayback.fixtureTitle');
    const downloadFixture = useCallback(() => {
        const payload: AgentChatReplayFixture = {
            ...fixture,
            metadata: {
                ...fixture.metadata,
                title: resolvedTitle,
                exported_at: fixture.metadata?.exported_at ?? new Date().toISOString(),
                message_count: messages.length,
            },
        };
        const runId = fixture.metadata?.agent_run_id ?? 'fixture';
        const filename = `${sanitizeFilenamePart(resolvedTitle) || 'agent-chat'}-${sanitizeFilenamePart(runId)}.json`;
        downloadJsonFile(filename, payload);
    }, [fixture, messages.length, resolvedTitle]);
    const handleReplayRequestInput = useCallback(() => {
        setCursor(getNextCursor(playback.cursor, messages.length));
    }, [messages.length, playback.cursor, setCursor]);

    return (
        <div
            className={cn('flex h-full min-h-0 w-full flex-col bg-background text-foreground', className)}
            data-agent-test-playback-enabled
            data-agent-playback-cursor={playback.cursor}
            data-agent-live-message-count={messages.length}
            data-agent-rendered-message-count={playback.renderedMessageCount}
            data-agent-replay-playing={isPlaying || undefined}
            data-agent-replay-loop={completedLoops}
        >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{resolvedTitle}</div>
                    <div className="text-xs text-muted">
                        {t('agent.testPlayback.fixtureMeta', {
                            messageCount: messages.length,
                            loops: completedLoops,
                        })}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={downloadFixture}>
                        <DownloadCloudIcon className="size-4" />
                        <span className="ms-1.5">{t('agent.testPlayback.exportFixture')}</span>
                    </Button>
                    {autoStepMs && autoStepMs > 0 && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsPlaying((value) => !value)}
                        >
                            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                            <span className="ms-1.5">
                                {isPlaying ? t('agent.testPlayback.pause') : t('agent.testPlayback.resume')}
                            </span>
                        </Button>
                    )}
                </div>
            </div>
            <AgentChatPlaybackControls cursor={playback.cursor} messages={messages} onChangeCursor={setCursor} />
            <AllMessagesMixed
                messages={displayedMessages}
                isCompleted={isCompleted}
                streamingMessages={streamingMessages}
                bottomRef={bottomRef as RefObject<HTMLDivElement>}
                artifactRunId={fixture.metadata?.agent_run_id ?? 'agent-chat-fixture'}
                viewMode={viewMode}
                renderRequestInputControls={!pendingRequestInputMessage}
            />
            {pendingRequestInputMessage && (
                <AgentRequestInputOverlay
                    message={pendingRequestInputMessage}
                    onSendMessage={handleReplayRequestInput}
                    isLoading={false}
                />
            )}
        </div>
    );
}
