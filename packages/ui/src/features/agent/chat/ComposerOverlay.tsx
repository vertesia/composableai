import { cn } from '@vertesia/ui/core';
import type { HTMLAttributes } from 'react';
import { AskUserWidget, type AskUserWidgetProps } from './AskUserWidget';

/** Placement shared by the prompts that take the composer's place while the run waits on the user. */
const COMPOSER_OVERLAY_CLASS = cn(
    'flex-shrink-0 border-t border-border/70 bg-background/95 backdrop-blur',
    'fixed bottom-0 end-0 start-0 z-20 lg:sticky lg:start-auto lg:end-auto',
    'pb-safe-area',
);

/** The bar that takes the composer's place while the run waits on the user. */
export function ComposerOverlay({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn(COMPOSER_OVERLAY_CLASS, className)} {...props} />;
}

type ComposerOverlayQuestionProps = Omit<AskUserWidgetProps, 'hideBorder' | 'compact' | 'className' | 'cardClassName'>;

/** A question asked in the composer's place, styled the same wherever it comes from. */
export function ComposerOverlayQuestion(props: ComposerOverlayQuestionProps) {
    return (
        <div className="mx-auto w-full max-w-3xl px-3 py-3">
            <AskUserWidget
                {...props}
                hideBorder
                compact
                className="my-0"
                cardClassName="bg-background/80 shadow-lg shadow-black/5"
            />
        </div>
    );
}
