import type { AgentMessage } from '@vertesia/common';
import { Button } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Radio } from 'lucide-react';
import {
    type AgentChatPlaybackCursor,
    getNextUserTurnIndex,
    getPlaybackCursorIndex,
    getPreviousUserTurnIndex,
} from './playback';

export interface AgentChatPlaybackControlsProps {
    cursor: AgentChatPlaybackCursor;
    messages: AgentMessage[];
    onChangeCursor: (cursor: AgentChatPlaybackCursor) => void;
    className?: string;
}

export function AgentChatPlaybackControls({
    cursor,
    messages,
    onChangeCursor,
    className,
}: AgentChatPlaybackControlsProps) {
    const { t } = useUITranslation();
    const messageCount = messages.length;
    const isLive = cursor === 'live';
    const cursorIndex = getPlaybackCursorIndex(cursor, messageCount);
    const previousUserTurnIndex = getPreviousUserTurnIndex(messages, cursor);
    const nextUserTurnIndex = getNextUserTurnIndex(messages, cursor);
    const canStepPrevious = messageCount > 0 && (isLive || cursorIndex > 0);
    const canStepNext = !isLive && messageCount > 0;

    const setPreviousMessage = () => {
        if (messageCount === 0) return;
        if (cursor === 'live') {
            onChangeCursor(messageCount - 1);
            return;
        }
        onChangeCursor(Math.max(0, cursorIndex - 1));
    };

    const setNextMessage = () => {
        if (messageCount === 0 || cursor === 'live') return;
        if (cursorIndex >= messageCount - 1) {
            onChangeCursor('live');
            return;
        }
        onChangeCursor(cursorIndex + 1);
    };

    const setPreviousUserTurn = () => {
        if (previousUserTurnIndex === null) return;
        onChangeCursor(previousUserTurnIndex);
    };

    const setNextUserTurn = () => {
        if (nextUserTurnIndex === null) return;
        onChangeCursor(nextUserTurnIndex);
    };

    return (
        <div
            className={
                className ??
                'flex flex-wrap items-center gap-1.5 border-b border-border bg-background/95 px-2 py-1.5 text-xs text-muted'
            }
            data-testid="agent-test-playback-controls"
            data-playback-cursor={cursor}
            data-live-message-count={messageCount}
            data-rendered-message-count={isLive ? messageCount : cursorIndex + 1}
        >
            <span className="me-1 font-medium text-foreground/80">{t('agent.testPlayback.label')}</span>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('agent.testPlayback.previousUserTurn')}
                title={t('agent.testPlayback.previousUserTurn')}
                disabled={previousUserTurnIndex === null}
                onClick={setPreviousUserTurn}
            >
                <ChevronsLeft className="size-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('agent.testPlayback.previousMessage')}
                title={t('agent.testPlayback.previousMessage')}
                disabled={!canStepPrevious}
                onClick={setPreviousMessage}
            >
                <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-20 text-center tabular-nums" data-testid="agent-test-playback-position">
                {isLive
                    ? t('agent.testPlayback.livePosition', { current: messageCount, total: messageCount })
                    : t('agent.testPlayback.position', { current: cursorIndex + 1, total: messageCount })}
            </span>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('agent.testPlayback.nextMessage')}
                title={t('agent.testPlayback.nextMessage')}
                disabled={!canStepNext}
                onClick={setNextMessage}
            >
                <ChevronRight className="size-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('agent.testPlayback.nextUserTurn')}
                title={t('agent.testPlayback.nextUserTurn')}
                disabled={nextUserTurnIndex === null}
                onClick={setNextUserTurn}
            >
                <ChevronsRight className="size-4" />
            </Button>
            <Button
                type="button"
                variant={isLive ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t('agent.testPlayback.jumpToLive')}
                title={t('agent.testPlayback.jumpToLive')}
                disabled={isLive}
                onClick={() => onChangeCursor('live')}
            >
                <Radio className="size-4" />
            </Button>
        </div>
    );
}
