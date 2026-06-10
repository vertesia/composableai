import type { AgentMessage } from '@vertesia/common';
import { Button, cn, Input } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type AgentChatPlaybackCursor, getPlaybackCursorIndex } from './playback';

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
    const canStepPrevious = messageCount > 0 && (isLive || cursorIndex > 0);
    const canStepNext = !isLive && messageCount > 0;
    const canJumpToStart = messageCount > 0 && (isLive || cursorIndex > 0);
    const canJumpToLatest = !isLive && messageCount > 0 && cursorIndex < messageCount - 1;
    const currentPosition = messageCount === 0 ? 0 : cursorIndex + 1;
    const [positionText, setPositionText] = useState(String(currentPosition));

    useEffect(() => {
        setPositionText(String(currentPosition));
    }, [currentPosition]);

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

    const jumpToStart = () => {
        if (messageCount === 0) return;
        onChangeCursor(0);
    };

    const jumpToLatest = () => {
        if (messageCount === 0) return;
        onChangeCursor(messageCount - 1);
    };

    const restorePositionText = () => {
        setPositionText(String(currentPosition));
    };

    const commitPosition = (value: string, restoreInvalid = false) => {
        if (messageCount === 0) {
            setPositionText('0');
            return;
        }
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) {
            if (restoreInvalid) restorePositionText();
            return;
        }
        const nextPosition = Math.min(Math.max(parsed, 1), messageCount);
        setPositionText(String(nextPosition));
        onChangeCursor(nextPosition - 1);
    };

    const iconButtonClassName = 'size-7 rounded-lg text-muted hover:text-foreground disabled:opacity-35';
    const positionInputWidth = `${Math.max(3, String(messageCount).length + 1)}ch`;

    return (
        <div
            className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-xl border border-border/70 bg-background/95 py-1 ps-4 pe-1 text-sm leading-none text-muted shadow-lg shadow-black/10 backdrop-blur',
                className,
            )}
            data-testid="agent-test-playback-controls"
            data-playback-cursor={cursor}
            data-live-message-count={messageCount}
            data-rendered-message-count={isLive ? messageCount : cursorIndex + 1}
        >
            <span className="me-1 font-medium leading-none text-foreground/80">{t('agent.rewind.label')}</span>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('agent.rewind.jumpToStart')}
                title={t('agent.rewind.jumpToStart')}
                disabled={!canJumpToStart}
                onClick={jumpToStart}
                className={iconButtonClassName}
            >
                <ChevronsLeft className="size-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('agent.rewind.previousMessage')}
                title={t('agent.rewind.previousMessage')}
                disabled={!canStepPrevious}
                onClick={setPreviousMessage}
                className={iconButtonClassName}
            >
                <ChevronLeft className="size-4" />
            </Button>
            <span
                className="inline-flex min-w-16 items-center justify-center gap-0.5 px-1 font-medium leading-none tabular-nums text-foreground/80"
                data-testid="agent-test-playback-position"
            >
                <Input
                    type="text"
                    variant="unstyled"
                    size="sm"
                    clearable={false}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={positionText}
                    aria-label={t('agent.rewind.positionInput')}
                    disabled={messageCount === 0}
                    onChange={(value) => {
                        const nextValue = value.replace(/\D/g, '');
                        setPositionText(nextValue);
                        if (nextValue !== '') commitPosition(nextValue);
                    }}
                    onBlur={(event) => commitPosition(event.currentTarget.value, true)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            commitPosition(event.currentTarget.value, true);
                            event.currentTarget.blur();
                        }
                    }}
                    style={{ width: positionInputWidth }}
                    className="h-7 w-auto rounded-md border border-transparent bg-transparent px-1 text-center text-sm font-medium leading-none tabular-nums text-foreground outline-none transition-colors hover:border-border focus:border-ring focus:bg-muted/30 disabled:opacity-50"
                />
                <span aria-hidden="true" className="text-muted">
                    /
                </span>
                <span className="text-muted">{messageCount}</span>
            </span>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('agent.rewind.nextMessage')}
                title={t('agent.rewind.nextMessage')}
                disabled={!canStepNext}
                onClick={setNextMessage}
                className={iconButtonClassName}
            >
                <ChevronRight className="size-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('agent.rewind.jumpToLatest')}
                title={t('agent.rewind.jumpToLatest')}
                disabled={!canJumpToLatest}
                onClick={jumpToLatest}
                className={iconButtonClassName}
            >
                <ChevronsRight className="size-4" />
            </Button>
            <Button
                type="button"
                variant={isLive ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t('agent.rewind.jumpToLive')}
                title={t('agent.rewind.jumpToLive')}
                disabled={isLive}
                onClick={() => onChangeCursor('live')}
                className={cn(iconButtonClassName, isLive && 'bg-muted text-foreground')}
            >
                <Radio className="size-4" />
            </Button>
        </div>
    );
}
