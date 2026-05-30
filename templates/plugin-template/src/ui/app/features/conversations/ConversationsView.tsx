import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import {
    Button,
    type FilterGroup,
    type FilterOption,
    FilterBar,
    FilterBtn,
    FilterClear,
    FilterProvider,
    Input,
    TBody,
    THead,
    Table,
} from '@vertesia/ui/core';
import { GenericPageNavHeader } from '@vertesia/ui/features';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useNavigate } from '@vertesia/ui/router';
import type { AgentRunSearchHit } from '@vertesia/common';
import { SortableHead } from '../../components/SortableHead';
import { ConversationRow } from './components/ConversationRow';
import { useConversationsListState } from './ConversationsListStateContext';
import { STATUS_VALUES, type FilterableField, type SortField } from './types';
import { getSelectValues } from './utils';

const SCROLL_HISTORY_KEY = 'conversationsScrollTop';

function persistScrollTop(scrollTop: number) {
    const state = (window.history.state as { data?: Record<string, unknown> } | null) ?? {};
    window.history.replaceState(
        {
            ...state,
            data: {
                ...((state.data as Record<string, unknown> | undefined) ?? {}),
                [SCROLL_HISTORY_KEY]: scrollTop,
            },
        },
        '',
    );
}

function readScrollTop(): number | undefined {
    const state = window.history.state as { data?: Record<string, unknown> } | null;
    const value = state?.data?.[SCROLL_HISTORY_KEY];
    return typeof value === 'number' ? value : undefined;
}

function findScrollableElement(start: HTMLElement | null): HTMLElement | null {
    let current: HTMLElement | null = start;
    while (current && current !== document.body) {
        const overflowY = window.getComputedStyle(current).overflowY;
        const canScroll =
            (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight;
        if (canScroll) return current;
        current = current.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
}

export function ConversationsView() {
    const { t } = useUITranslation();
    const navigate = useNavigate();

    const {
        query,
        setQuery,
        filters,
        setFilters,
        sortField,
        setSortField,
        sortDir,
        setSortDir,
        hits,
        isLoading,
        refetch,
        scrollTopRef,
    } = useConversationsListState();

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollElRef = useRef<HTMLElement | null>(null);
    const restoreDoneRef = useRef(false);

    // Persist scroll on every event; do NOT persist on cleanup (DOM detached → scrollTop=0).
    useEffect(() => {
        const el = findScrollableElement(scrollContainerRef.current);
        scrollElRef.current = el;
        if (!el) return;
        const onScroll = () => {
            scrollTopRef.current = el.scrollTop;
            persistScrollTop(el.scrollTop);
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', onScroll);
        };
    }, [scrollTopRef]);

    // Restore scroll synchronously inside useLayoutEffect (before paint).
    useLayoutEffect(() => {
        if (restoreDoneRef.current) return;
        if (isLoading || hits.length === 0) return;
        const target = readScrollTop() ?? scrollTopRef.current;
        if (target <= 0) {
            restoreDoneRef.current = true;
            return;
        }
        const trySync = (): boolean => {
            const el = scrollElRef.current ?? findScrollableElement(scrollContainerRef.current);
            scrollElRef.current = el;
            if (!el) return false;
            const maxScroll = el.scrollHeight - el.clientHeight;
            if (maxScroll < target) return false;
            el.scrollTop = target;
            return true;
        };
        if (trySync()) {
            restoreDoneRef.current = true;
            return;
        }
        let attempts = 0;
        const maxAttempts = 10;
        let cancelled = false;
        const tryAsync = () => {
            if (cancelled) return;
            if (trySync() || attempts >= maxAttempts) {
                const el = scrollElRef.current;
                if (el && !restoreDoneRef.current) {
                    const maxScroll = el.scrollHeight - el.clientHeight;
                    el.scrollTop = Math.min(target, Math.max(maxScroll, 0));
                }
                restoreDoneRef.current = true;
                return;
            }
            attempts++;
            requestAnimationFrame(tryAsync);
        };
        const frame = requestAnimationFrame(tryAsync);
        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
        };
    }, [isLoading, hits.length, scrollTopRef]);

    // Build agent-filter options dynamically from the loaded set.
    const agentOptions = useMemo(() => {
        const seen = new Map<string, string>();
        for (const hit of hits) {
            const code = hit.interaction;
            if (!code) continue;
            const label = hit.interaction_name || code;
            if (!seen.has(code)) seen.set(code, label);
        }
        return [...seen.entries()]
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [hits]);

    // Multi-agent filtering is client-side because the backend `interaction`
    // param is single-valued. Backend already handled query + status + the
    // single-agent case. Sort is also client-side (backend offers no sort).
    const displayedHits = useMemo(() => {
        const agents = new Set(getSelectValues(filters, 'agent'));
        const filtered = agents.size > 1 ? hits.filter((hit) => hit.interaction && agents.has(hit.interaction)) : hits;

        const dirSign = sortDir === 'asc' ? 1 : -1;
        const getSortValue = (hit: AgentRunSearchHit): string => {
            switch (sortField) {
                case 'topic':
                    return (hit.topic ?? hit.title ?? '').toLowerCase();
                case 'agent':
                    return hit.interaction ?? '';
                case 'status':
                    return hit.status ?? '';
                default:
                    return hit.started_at ?? '';
            }
        };
        return [...filtered].sort((a, b) => {
            const va = getSortValue(a);
            const vb = getSortValue(b);
            if (va < vb) return -1 * dirSign;
            if (va > vb) return 1 * dirSign;
            return 0;
        });
    }, [hits, filters, sortField, sortDir]);

    const handleSort = useCallback(
        (field: SortField) => {
            if (sortField === field) {
                setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
                return;
            }
            setSortField(field);
            setSortDir('asc');
        },
        [sortField, setSortField, setSortDir],
    );

    const handleOpen = useCallback((id: string) => navigate(`/chat/${id}`), [navigate]);

    const addFilterValue = useCallback(
        (name: FilterableField, value: string, label: string) => {
            const placeholder = name === 'status' ? t('conversations.filterStatus') : t('conversations.filterAgent');
            const newOption: FilterOption = { value, label };
            setFilters((prev) => {
                const existing = prev.find((f) => f.name === name);
                if (!existing) {
                    return [...prev, { name, placeholder, type: 'select', multiple: true, value: [newOption] }];
                }
                const currentValues = Array.isArray(existing.value) ? existing.value : [];
                const alreadyHas = currentValues.some((v) => (typeof v === 'string' ? v : v.value) === value);
                if (alreadyHas) return prev;
                return prev.map((f) =>
                    f === existing ? { ...f, value: [...(f.value as FilterOption[]), newOption] } : f,
                );
            });
        },
        [t, setFilters],
    );

    const filterGroups: FilterGroup[] = useMemo(
        () => [
            {
                name: 'agent',
                placeholder: t('conversations.filterAgent'),
                type: 'select',
                multiple: true,
                options: agentOptions,
            },
            {
                name: 'status',
                placeholder: t('conversations.filterStatus'),
                type: 'select',
                multiple: true,
                options: STATUS_VALUES.map((s) => ({ value: s, label: s })),
            },
        ],
        [agentOptions, t],
    );

    const showEmpty = !isLoading && displayedHits.length === 0;

    return (
        <div className="flex flex-col h-full">
            <GenericPageNavHeader title={t('conversations.title')} useDynamicBreadcrumbs={false} />
            <div className="flex flex-col gap-4 p-4 flex-1 min-h-0">
                <FilterProvider filters={filters} setFilters={setFilters} filterGroups={filterGroups}>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-md">
                            <Input
                                value={query}
                                onChange={setQuery}
                                placeholder={t('conversations.searchPlaceholder')}
                            />
                        </div>
                        <FilterBtn />
                        <FilterClear />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            isDisabled={isLoading}
                            alt={t('conversations.refresh')}
                            className="ms-auto"
                        >
                            <RefreshCw />
                        </Button>
                    </div>
                    <FilterBar />
                </FilterProvider>

                <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto">
                    <Table className="w-full">
                        <THead>
                            <tr>
                                <SortableHead
                                    field="topic"
                                    label={t('conversations.col.topic')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                    className="w-1/2"
                                />
                                <SortableHead
                                    field="agent"
                                    label={t('conversations.col.agent')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                    className="w-64"
                                />
                                <SortableHead
                                    field="status"
                                    label={t('conversations.col.status')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                    className="w-32"
                                />
                                <SortableHead
                                    field="started"
                                    label={t('conversations.col.started')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                    className="w-48"
                                />
                            </tr>
                        </THead>
                        <TBody isLoading={isLoading} columns={4} rows={6}>
                            {displayedHits.map((hit) => (
                                <ConversationRow
                                    key={hit.id}
                                    hit={hit}
                                    t={t}
                                    onAddFilter={addFilterValue}
                                    onOpen={handleOpen}
                                />
                            ))}
                        </TBody>
                    </Table>
                    {showEmpty && (
                        <div className="text-center text-sm text-muted-foreground py-8">{t('conversations.empty')}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
