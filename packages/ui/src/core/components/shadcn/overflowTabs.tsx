import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronDownIcon } from 'lucide-react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '../libs/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown';

/** Gap between tab items, in px — must match the `gap-1` used by the rendered rows. */
export const OVERFLOW_TAB_GAP_PX = 4;

export type OverflowTabsVariant = 'tabs' | 'pills';

/** Tab-item styling, matching the corresponding `TabsTrigger` variants. */
const VARIANT_CLASSES: Record<OverflowTabsVariant, { base: string; active: string; inactive: string; icon: string }> = {
    tabs: {
        base: 'flex items-center border-b-2 px-2 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer shrink-0',
        inactive: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
        active: 'border-primary text-primary',
        icon: 'ms-1 size-4',
    },
    pills: {
        base: 'flex items-center rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap cursor-pointer shrink-0',
        inactive: 'text-muted-foreground hover:bg-muted/60',
        active: 'bg-muted text-foreground',
        icon: 'ms-0.5 size-3.5',
    },
};

export interface OverflowTabsLayout<T> {
    /** Attach to the element whose width bounds the row; its `clientWidth` is what tabs are fitted into. */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Ref callback for the i-th item of the hidden measurement row. */
    setItemRef: (index: number) => (el: HTMLElement | null) => void;
    /** Ref callback for the "More" button of the hidden measurement row. */
    setMoreRef: (el: HTMLElement | null) => void;
    /** Items that fit; when the active item overflowed it is promoted into the last slot. */
    visible: T[];
    /** Items that did not fit and belong in the "More" menu. */
    overflow: T[];
    /** Whether the active item ended up in `overflow` (used to highlight the "More" trigger). */
    activeInOverflow: boolean;
}

/**
 * Splits `items` into a visible row and an overflow list, measured from a hidden row that renders
 * every item at its natural width (see {@link OverflowTabsBar} for the expected markup). The active
 * item is promoted into the last visible slot when it would otherwise be hidden in the menu.
 *
 * Callers own the rendering, so the hidden row must use the same classes and content as the visible
 * one — otherwise the measured widths don't describe what is actually laid out.
 */
export function useOverflowTabs<T>(
    items: T[],
    isActive: (item: T) => boolean,
    gap = OVERFLOW_TAB_GAP_PX,
): OverflowTabsLayout<T> {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<Array<HTMLElement | null>>([]);
    const moreRef = useRef<HTMLElement | null>(null);
    // `count` leading items are shown. When `promote` is set, the active item is pulled
    // into the last slot (before More) and `count` counts the items shown before it.
    const [layout, setLayout] = useState<{ count: number; promote: boolean }>({
        count: items.length,
        promote: false,
    });

    const recompute = () => {
        const container = containerRef.current;
        if (!container) return;
        const containerWidth = container.clientWidth;
        const widths = items.map((_, i) => itemRefs.current[i]?.offsetWidth ?? 0);
        const totalAll = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, items.length - 1);

        // How many items (in order, optionally skipping one) fit within `available`.
        const fitCount = (available: number, skipIndex: number) => {
            let used = 0;
            let fitted = 0;
            for (let i = 0; i < items.length; i++) {
                if (i === skipIndex) continue;
                const cand = used + (fitted > 0 ? gap : 0) + widths[i];
                if (cand > available) break;
                used = cand;
                fitted += 1;
            }
            return fitted;
        };

        let next: { count: number; promote: boolean };
        if (totalAll <= containerWidth) {
            next = { count: items.length, promote: false };
        } else {
            const moreWidth = moreRef.current?.offsetWidth ?? 0;
            const naturalCount = Math.max(1, fitCount(containerWidth - moreWidth - gap, -1));
            const activeIndex = items.findIndex(isActive);
            if (activeIndex < 0 || activeIndex < naturalCount) {
                next = { count: naturalCount, promote: false };
            } else {
                // Active item overflowed: reserve its slot at the end, fit leading items before it.
                const leadAvailable = containerWidth - moreWidth - widths[activeIndex] - gap * 2;
                next = { count: fitCount(leadAvailable, activeIndex), promote: true };
            }
        }
        setLayout((prev) => (prev.count === next.count && prev.promote === next.promote ? prev : next));
    };

    // Re-measure after every render (item/label changes) and on container resize.
    const recomputeRef = useRef(recompute);
    recomputeRef.current = recompute;
    useLayoutEffect(() => {
        recomputeRef.current();
    });
    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => recomputeRef.current());
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const activeIndex = items.findIndex(isActive);
    let visible: T[];
    let overflow: T[];
    if (layout.promote && activeIndex >= 0) {
        // Pull the active item into the last visible slot; the item it displaces overflows.
        const others = items.filter((_, i) => i !== activeIndex);
        visible = [...others.slice(0, layout.count), items[activeIndex]];
        overflow = others.slice(layout.count);
    } else {
        visible = items.slice(0, layout.count);
        overflow = items.slice(layout.count);
    }

    return {
        containerRef,
        setItemRef: (index: number) => (el: HTMLElement | null) => {
            itemRefs.current[index] = el;
        },
        setMoreRef: (el: HTMLElement | null) => {
            moreRef.current = el;
        },
        visible,
        overflow,
        activeInOverflow: overflow.some(isActive),
    };
}

export interface OverflowMoreMenuProps {
    label: ReactNode;
    /** Classes for the trigger button — pass the same tab-item classes the row uses. */
    triggerClassName?: string;
    /** Icon after the label; the hidden measurement row must render the same one. */
    icon?: ReactNode;
    /** The menu entries, normally `DropdownMenuItem`s rendered by the caller. */
    children: ReactNode;
}

/** Trailing "More" dropdown of overflowed tabs; opens on hover, click, or keyboard. */
export function OverflowMoreMenu({ label, triggerClassName, icon, children }: OverflowMoreMenuProps) {
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const openedByHover = useRef(false);

    const cancelClose = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };
    const openOnHover = () => {
        cancelClose();
        openedByHover.current = true;
        setOpen(true);
    };
    // Delay the close so the pointer can travel across the gap onto the menu.
    const closeAfterDelay = () => {
        cancelClose();
        closeTimer.current = setTimeout(() => setOpen(false), 150);
    };

    // Clear any pending close timer on unmount.
    useEffect(() => () => clearTimeout(closeTimer.current ?? undefined), []);

    return (
        // Non-modal: a modal menu sets body `pointer-events: none` while open, which makes
        // the hover open/close flap. It still closes on outside-click / Escape.
        <DropdownMenu
            modal={false}
            open={open}
            onOpenChange={(next) => {
                // Fired by click / keyboard / dismiss (not by hover); keep our state in sync.
                cancelClose();
                if (next) openedByHover.current = false;
                setOpen(next);
            }}
        >
            <DropdownMenuTrigger asChild>
                {/* Tab-bar primitive: raw button is the menu trigger (asChild). */}
                <button
                    type="button"
                    onMouseEnter={openOnHover}
                    onMouseLeave={closeAfterDelay}
                    className={triggerClassName}
                >
                    {label}
                    {icon ?? <ChevronDownIcon className="ms-1 size-4" />}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-max"
                onMouseEnter={cancelClose}
                onMouseLeave={closeAfterDelay}
                onCloseAutoFocus={(e) => {
                    // Keep hover-opens from returning the focus ring to the trigger.
                    if (openedByHover.current) e.preventDefault();
                }}
            >
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Minimal tab shape the bar needs; the richer core `Tab` satisfies it as-is. */
export interface OverflowTab {
    name: string;
    label: ReactNode;
    disabled?: boolean;
}

export interface OverflowTabsBarProps {
    tabs: OverflowTab[];
    current: string;
    onTabChange: (name: string) => void;
    /** `tabs` draws the underline bar (default), `pills` the compact rounded row. */
    variant?: OverflowTabsVariant;
    className?: string;
}

/**
 * Tabs as a horizontal row; any that don't fit collapse into a trailing "More" dropdown. Unlike
 * `TabsBar` this is a bar only — it does not own the panels — so it suits tab rows whose content is
 * rendered by the caller. The visible/overflow split is measured from a hidden full-width row.
 */
export function OverflowTabsBar({ tabs, current, onTabChange, variant = 'tabs', className }: OverflowTabsBarProps) {
    const { t } = useUITranslation();
    const styles = VARIANT_CLASSES[variant];
    const { containerRef, setItemRef, setMoreRef, visible, overflow, activeInOverflow } = useOverflowTabs(
        tabs,
        (tab) => tab.name === current,
    );
    const moreLabel = t('agent.moreTabs');

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {/* Hidden measurement row: all tabs + More at natural width, kept separate
                from the visible row so measuring can't feed back into the layout. */}
            <div aria-hidden className="pointer-events-none invisible absolute start-0 top-0 flex w-max gap-1">
                {tabs.map((tab, i) => (
                    <button
                        type="button"
                        key={tab.name}
                        tabIndex={-1}
                        ref={setItemRef(i)}
                        className={cn(styles.base, styles.inactive)}
                    >
                        {tab.label}
                    </button>
                ))}
                <button type="button" tabIndex={-1} ref={setMoreRef} className={cn(styles.base, styles.inactive)}>
                    {moreLabel}
                    <ChevronDownIcon className={styles.icon} />
                </button>
            </div>

            {/* Visible row */}
            <div className={cn('flex gap-1 overflow-hidden', variant === 'tabs' && '-mb-px border-b')}>
                {visible.map((tab) => {
                    const isActive = tab.name === current;
                    return (
                        // Tab-bar primitive: raw button mirrors core TabsTrigger styling.
                        <button
                            type="button"
                            key={tab.name}
                            aria-current={isActive ? 'page' : undefined}
                            disabled={tab.disabled}
                            onClick={() => onTabChange(tab.name)}
                            className={cn(
                                styles.base,
                                isActive ? styles.active : styles.inactive,
                                'disabled:pointer-events-none disabled:opacity-50',
                            )}
                        >
                            {tab.label}
                        </button>
                    );
                })}

                {overflow.length > 0 && (
                    <OverflowMoreMenu
                        label={moreLabel}
                        triggerClassName={cn(styles.base, activeInOverflow ? styles.active : styles.inactive)}
                        icon={<ChevronDownIcon className={styles.icon} />}
                    >
                        {overflow.map((tab) => (
                            <DropdownMenuItem
                                key={tab.name}
                                disabled={tab.disabled}
                                onClick={() => onTabChange(tab.name)}
                                className={cn(tab.name === current && 'text-primary')}
                            >
                                {tab.label}
                            </DropdownMenuItem>
                        ))}
                    </OverflowMoreMenu>
                )}
            </div>
        </div>
    );
}
