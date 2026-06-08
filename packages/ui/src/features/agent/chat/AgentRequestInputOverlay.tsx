import { cn } from '@vertesia/ui/core';
import { AskUserWidget } from './AskUserWidget';
import { getAgentMessageText, type RequestInputMessageWithUx } from './ModernAgentOutput/requestInputMessages';

export interface AgentRequestInputOverlayProps {
    message?: RequestInputMessageWithUx;
    onSendMessage?: (message: string) => void;
    isLoading?: boolean;
    disabled?: boolean;
    className?: string;
}

export function AgentRequestInputOverlay({
    message,
    onSendMessage,
    isLoading = false,
    disabled = false,
    className,
}: AgentRequestInputOverlayProps) {
    if (!message) return null;

    const uxConfig = message.details.ux;
    const options = uxConfig.options ?? [];
    const isDisabled = disabled || isLoading || !onSendMessage;
    const send = (value: string) => {
        if (isDisabled) return;
        onSendMessage?.(value);
    };

    return (
        <div
            className={cn(
                'flex-shrink-0 border-t border-border/70 bg-background/95 backdrop-blur',
                'fixed bottom-0 end-0 start-0 z-20 lg:sticky lg:start-auto lg:end-auto',
                className,
            )}
            data-agent-request-input-overlay
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            <div className="mx-auto w-full max-w-3xl px-3 py-3">
                <AskUserWidget
                    question={getAgentMessageText(message)}
                    options={options}
                    variant={uxConfig.variant}
                    multiSelect={uxConfig.multiSelect}
                    allowFreeResponse={options.length === 0}
                    onSelect={send}
                    onMultiSelect={(optionIds) => send(optionIds.join(', '))}
                    onSubmit={send}
                    hideBorder
                    compact
                    isLoading={isDisabled}
                    className="my-0"
                    cardClassName="bg-background/80 shadow-lg shadow-black/5 dark:shadow-none"
                />
            </div>
        </div>
    );
}
