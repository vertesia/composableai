import { useState } from 'react';
import { VTooltip } from './tooltip';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from './button';

interface PanelProps {
    title: string | React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    children: React.ReactNode;
    footer?: string | React.ReactNode;
    className?: string;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    /** 'sm' renders a compact header with smaller text. Defaults to 'md' (original behaviour). */
    size?: 'sm' | 'md';
    /** When true and collapsible, the entire header row acts as the toggle instead of just the icon button. */
    clickableHeader?: boolean;
}

export function Panel({
    children,
    action,
    title,
    description,
    footer,
    className,
    collapsible,
    defaultCollapsed = false,
    size = 'md',
    clickableHeader = false,
}: PanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const useClickableHeader = collapsible && clickableHeader;
    const isSmall = size === 'sm';
    // When compact or using a clickable header, manage padding per-section so
    // the header button can be flush with the card edge.
    const sectioned = isSmall || useClickableHeader;

    const chevron = isCollapsed ? (
        <ChevronDown className="size-4 text-muted" />
    ) : (
        <ChevronUp className="size-4 text-muted" />
    );

    const headerInner = (
        <>
            <div className="flex items-center gap-2">
                <div className={`font-semibold ${isSmall ? 'text-sm' : 'text-lg'}`}>{title}</div>
                {description && (
                    <VTooltip description={description}>
                        <Info className="size-4 text-muted" />
                    </VTooltip>
                )}
            </div>
            <div className="flex gap-2 items-center">
                {action}
                {collapsible &&
                    (useClickableHeader ? (
                        chevron
                    ) : (
                        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
                            {chevron}
                        </Button>
                    ))}
            </div>
        </>
    );

    const headerPadding = isSmall ? 'px-4 py-2' : 'px-4 py-3';
    const contentPadding = isSmall ? 'px-4 pt-3 pb-3' : 'p-4';
    const footerPadding = isSmall ? 'px-4 pb-3' : 'px-4 pb-4';

    return (
        <div
            className={`flex flex-col ${sectioned ? '' : 'p-4 gap-2'} rounded-sm border bg-card overflow-hidden ${className ?? ''}`}
        >
            {useClickableHeader ? (
                <button
                    type="button"
                    className={`w-full flex items-center justify-between ${headerPadding} hover:bg-muted/50 transition-colors`}
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {headerInner}
                </button>
            ) : (
                <div className={`flex items-center justify-between ${sectioned ? headerPadding : ''}`}>
                    {headerInner}
                </div>
            )}
            {!isCollapsed && (sectioned ? <div className={contentPadding}>{children}</div> : children)}
            {footer && (
                <div className={`border-t border-muted flex flex-col-2 text-sm pt-4 ${sectioned ? footerPadding : ''}`}>
                    {footer}
                </div>
            )}
        </div>
    );
}
