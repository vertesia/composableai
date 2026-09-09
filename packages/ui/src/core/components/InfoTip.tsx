import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './libs/utils';
import { VTooltip } from './shadcn/tooltip';

interface InfoTipProps {
    /** Tooltip text. Renders nothing when empty, so an optional value can be passed
     *  straight through without guarding it at the call site. */
    description?: ReactNode;
    /** `sm` (default) sits beside a form label; `md` beside a panel or section title. */
    size?: 'sm' | 'md';
    placement?: 'top' | 'right' | 'bottom' | 'left';
    className?: string;
}

/**
 * The Info-icon tooltip that sits next to a label or a heading.
 *
 * Hover-only, like every `VTooltip`. It is NOT a substitute for `FormItem`'s `helpText`,
 * which is the prop that links guidance to a control through `aria-describedby` — see the
 * note on `FormItem.description`.
 */
export function InfoTip({ description, size = 'sm', placement = 'top', className }: InfoTipProps) {
    if (!description) {
        return null;
    }
    return (
        <VTooltip description={description} placement={placement}>
            <Info className={cn(size === 'md' ? 'size-4' : 'size-3', 'text-muted', className)} />
        </VTooltip>
    );
}
