import type { AgentMessage } from '@vertesia/common';
import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@vertesia/ui/core';
import { i18nInstance, NAMESPACE, useUITranslation } from '@vertesia/ui/i18n';
import { CheckCircle, ChevronDown, Clock } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getWorkstreamId } from './utils';

interface WorkstreamTabsProps {
    workstreams: Map<string, string>; // Map of workstream_id to displayName
    activeWorkstream: string;
    onSelectWorkstream: (id: string) => void;
    count?: Map<string, number>; // Optional count of messages per workstream
    completionStatus?: Map<string, boolean>; // Optional completion status per workstream
}

// Tab-item styling for the header workstream bar: filled `bg-info` active pill with
// count badges and completion icons (distinct from the right panel's underline tabs).
const TAB_ITEM_BASE =
    'flex items-center gap-1.5 px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors border-b-2 shrink-0 cursor-pointer';
const TAB_ITEM_INACTIVE = 'border-transparent text-muted hover:bg-muted';
const TAB_ITEM_ACTIVE = 'border-info bg-info text-info';
const TAB_GAP_PX = 4; // matches the `gap-1` between tab items

// Shorten long workstream names for the tab row.
function truncateName(name: string) {
    return name.length > 20 ? `${name.substring(0, 18)}...` : name;
}

type WorkstreamEntry = [id: string, name: string];

interface WorkstreamMoreMenuProps {
    /** The overflowed workstream entries to list inside the menu. */
    items: WorkstreamEntry[];
    current: string;
    onSelect: (id: string) => void;
    label: string;
    /** Whether the active workstream is one of the overflowed entries. */
    active: boolean;
    count?: Map<string, number>;
    completionStatus?: Map<string, boolean>;
}

/** Trailing "More" dropdown of overflowed workstream tabs; opens on hover, click, or keyboard. */
function WorkstreamMoreMenu({
    items,
    current,
    onSelect,
    label,
    active,
    count,
    completionStatus,
}: WorkstreamMoreMenuProps) {
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
                    className={cn(TAB_ITEM_BASE, active ? TAB_ITEM_ACTIVE : TAB_ITEM_INACTIVE)}
                >
                    {label}
                    <ChevronDown className="ms-0.5 size-3.5" />
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
                {items.map(([id, name]) => {
                    // biome-ignore lint/style/noNonNullAssertion: guarded by count?.has(id).
                    const showCount = count?.has(id) && count.get(id)! > 0;
                    return (
                        <DropdownMenuItem
                            key={id}
                            onClick={() => onSelect(id)}
                            className={cn('flex items-center gap-2', id === current && 'text-info')}
                        >
                            <span className="truncate">{name}</span>
                            {showCount && (
                                <span className="ms-auto inline-flex items-center gap-1">
                                    <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-[10px] text-muted">
                                        {count?.get(id)}
                                    </span>
                                    {completionStatus &&
                                        id !== 'all' &&
                                        (completionStatus.get(id) ? (
                                            <CheckCircle className="size-3 text-success" />
                                        ) : (
                                            <Clock className="size-3 text-attention" />
                                        ))}
                                </span>
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

interface WorkstreamOverflowBarProps {
    entries: WorkstreamEntry[];
    activeWorkstream: string;
    onSelectWorkstream: (id: string) => void;
    count?: Map<string, number>;
    completionStatus?: Map<string, boolean>;
}

/**
 * Workstream tabs as a horizontal row; any that don't fit collapse into a trailing
 * "More" dropdown. The visible/overflow split is measured from a hidden full-width row,
 * and the active tab is always promoted into view so it can never hide in the menu.
 */
function WorkstreamOverflowBar({
    entries,
    activeWorkstream,
    onSelectWorkstream,
    count,
    completionStatus,
}: WorkstreamOverflowBarProps) {
    const { t } = useUITranslation();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const moreRef = useRef<HTMLButtonElement | null>(null);
    // `count` leading tabs are shown. When `promote` is set, the active tab is pulled
    // into the last slot (before More) and `count` counts the tabs shown before it.
    const [layout, setLayout] = useState<{ count: number; promote: boolean }>({
        count: entries.length,
        promote: false,
    });

    const recompute = () => {
        const container = containerRef.current;
        if (!container) return;
        const containerWidth = container.clientWidth;
        const widths = entries.map((_, i) => itemRefs.current[i]?.offsetWidth ?? 0);
        const totalAll = widths.reduce((sum, w) => sum + w, 0) + TAB_GAP_PX * Math.max(0, entries.length - 1);

        // How many tabs (in order, optionally skipping one) fit within `available`.
        const fitCount = (available: number, skipIndex: number) => {
            let used = 0;
            let fitted = 0;
            for (let i = 0; i < entries.length; i++) {
                if (i === skipIndex) continue;
                const cand = used + (fitted > 0 ? TAB_GAP_PX : 0) + widths[i];
                if (cand > available) break;
                used = cand;
                fitted += 1;
            }
            return fitted;
        };

        let next: { count: number; promote: boolean };
        if (totalAll <= containerWidth) {
            next = { count: entries.length, promote: false };
        } else {
            const moreWidth = moreRef.current?.offsetWidth ?? 0;
            const naturalCount = Math.max(1, fitCount(containerWidth - moreWidth - TAB_GAP_PX, -1));
            const activeIndex = entries.findIndex(([id]) => id === activeWorkstream);
            if (activeIndex < 0 || activeIndex < naturalCount) {
                next = { count: naturalCount, promote: false };
            } else {
                // Active tab overflowed: reserve its slot at the end, fit leading tabs before it.
                const leadAvailable = containerWidth - moreWidth - widths[activeIndex] - TAB_GAP_PX * 2;
                next = { count: fitCount(leadAvailable, activeIndex), promote: true };
            }
        }
        setLayout((prev) => (prev.count === next.count && prev.promote === next.promote ? prev : next));
    };

    // Re-measure after every render (tab/label changes) and on container resize.
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

    const activeIndex = entries.findIndex(([id]) => id === activeWorkstream);
    let visible: WorkstreamEntry[];
    let overflow: WorkstreamEntry[];
    if (layout.promote && activeIndex >= 0) {
        // Pull the active tab into the last visible slot; the tab it displaces overflows.
        const others = entries.filter((_, i) => i !== activeIndex);
        visible = [...others.slice(0, layout.count), entries[activeIndex]];
        overflow = others.slice(layout.count);
    } else {
        visible = entries.slice(0, layout.count);
        overflow = entries.slice(layout.count);
    }
    const activeInOverflow = overflow.some(([id]) => id === activeWorkstream);
    const moreLabel = t('agent.moreTabs');

    // Inner tab content (name + count badge + completion icon), shared by the hidden
    // measurement row and the visible row so their measured widths match.
    const renderTabInner = (id: string, name: string, isActive: boolean) => {
        // biome-ignore lint/style/noNonNullAssertion: guarded by count?.has(id).
        const showCount = count?.has(id) && count.get(id)! > 0;
        return (
            <>
                {truncateName(name)}
                {showCount && (
                    <span className="flex items-center gap-1">
                        <span
                            className={cn(
                                'inline-flex items-center justify-center p-1 text-xs rounded-full',
                                isActive ? 'bg-info text-info' : 'bg-muted text-muted',
                            )}
                        >
                            {count?.get(id)}
                        </span>
                        {/* Show completion status indicator if we have it and it's not 'all' */}
                        {completionStatus &&
                            id !== 'all' &&
                            (completionStatus.get(id) ? (
                                <CheckCircle className="size-3 text-success" />
                            ) : (
                                <Clock className="size-3 text-attention" />
                            ))}
                    </span>
                )}
            </>
        );
    };

    return (
        <div ref={containerRef} className="relative mb-1 bg-muted border-b border-muted/20">
            {/* Hidden measurement row: all tabs + More at natural width, kept separate
                from the visible row so measuring can't feed back into the layout. */}
            <div aria-hidden className="pointer-events-none invisible absolute start-0 top-0 flex w-max gap-1">
                {entries.map(([id, name], i) => (
                    <button
                        type="button"
                        key={id}
                        tabIndex={-1}
                        ref={(el) => {
                            itemRefs.current[i] = el;
                        }}
                        className={cn(TAB_ITEM_BASE, TAB_ITEM_INACTIVE)}
                    >
                        {renderTabInner(id, name, false)}
                    </button>
                ))}
                <button type="button" tabIndex={-1} ref={moreRef} className={cn(TAB_ITEM_BASE, TAB_ITEM_INACTIVE)}>
                    {moreLabel}
                    <ChevronDown className="ms-0.5 size-3.5" />
                </button>
            </div>

            {/* Visible row */}
            <div className="flex gap-1 overflow-hidden">
                {visible.map(([id, name]) => {
                    const isActive = activeWorkstream === id;
                    return (
                        // Tab-bar primitive: raw button mirrors the filled active-pill styling.
                        <button
                            type="button"
                            key={id}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => onSelectWorkstream(id)}
                            title={name.length > 20 ? name : undefined}
                            className={cn(TAB_ITEM_BASE, isActive ? TAB_ITEM_ACTIVE : TAB_ITEM_INACTIVE)}
                        >
                            {renderTabInner(id, name, isActive)}
                        </button>
                    );
                })}

                {overflow.length > 0 && (
                    <WorkstreamMoreMenu
                        items={overflow}
                        current={activeWorkstream}
                        onSelect={onSelectWorkstream}
                        label={moreLabel}
                        active={activeInOverflow}
                        count={count}
                        completionStatus={completionStatus}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Component that displays tabs for different workstreams
 */
export default function WorkstreamTabs({
    workstreams,
    activeWorkstream,
    onSelectWorkstream,
    count,
    completionStatus,
}: WorkstreamTabsProps) {
    const { t } = useUITranslation();
    // Create a new map with just the core workstreams
    const filteredWorkstreams = new Map<string, string>();
    filteredWorkstreams.set('all', t('agent.allMessages'));
    filteredWorkstreams.set('main', t('agent.main'));

    // Only add actual workstreams from messages (not our test workstreams)
    workstreams.forEach((name, id) => {
        if (id !== 'all' && id !== 'main' && id !== 'research_france' && id !== 'statistics') {
            filteredWorkstreams.set(id, name);
        }
    });

    // Replace workstreams with our filtered version
    workstreams = filteredWorkstreams;
    // Sort workstream entries in a predictable order:
    // 1. 'all' first
    // 2. 'main' second
    // 3. The rest alphabetically by ID
    const sortedWorkstreams = Array.from(workstreams.entries()).sort(([idA], [idB]) => {
        if (idA === 'all') return -1;
        if (idB === 'all') return 1;
        if (idA === 'main') return -1;
        if (idB === 'main') return 1;
        return idA.localeCompare(idB);
    });

    // Only show tabs if there are multiple workstreams (more than just 'all' and 'main')
    const hasMultipleWorkstreams = sortedWorkstreams.length > 2;

    // If there are no multiple workstreams, return an empty div to maintain layout
    if (!hasMultipleWorkstreams) {
        return <div className="py-0.5"></div>;
    }

    return (
        <WorkstreamOverflowBar
            entries={sortedWorkstreams}
            activeWorkstream={activeWorkstream}
            onSelectWorkstream={onSelectWorkstream}
            count={count}
            completionStatus={completionStatus}
        />
    );
}

/**
 * Helper function to extract workstream information from messages
 */
export function extractWorkstreams(messages: AgentMessage[]): Map<string, string> {
    const workstreams = new Map<string, string>();
    const t = i18nInstance.getFixedT(null, NAMESPACE);

    // Always include "all" and "main" workstreams
    workstreams.set('all', t('agent.allMessages'));
    workstreams.set('main', t('agent.main'));

    // Extract workstream IDs directly from message.workstream_id only
    messages.forEach((message) => {
        if (
            message.workstream_id &&
            message.workstream_id !== 'main' &&
            message.workstream_id !== 'all' &&
            !workstreams.has(message.workstream_id)
        ) {
            // Use the workstream_id as both the ID and the display name
            workstreams.set(message.workstream_id, message.workstream_id);
        }
    });

    return workstreams;
}

/**
 * Filter messages by workstream
 */
export function filterMessagesByWorkstream(messages: AgentMessage[], workstreamId: string): AgentMessage[] {
    if (workstreamId === 'all') {
        // Show all messages, no filtering needed
        return [...messages];
    } else if (workstreamId === 'main') {
        // For the main workstream, show only messages that belong to the main workstream
        // This excludes messages that belong to specific tasks/workstreams
        return messages.filter((message) => {
            const msgWorkstreamId = getWorkstreamId(message);
            return msgWorkstreamId === 'main';
        });
    } else {
        // For specific workstreams, show only messages that match the workstream_id
        return messages.filter((message) => {
            const msgWorkstreamId = getWorkstreamId(message);
            return msgWorkstreamId === workstreamId;
        });
    }
}
