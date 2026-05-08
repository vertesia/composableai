import {
    startTransition,
    useCallback,
    useDeferredValue,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
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
    Spinner,
    TBody,
    THead,
    Table,
    useIntersectionObserver,
} from '@vertesia/ui/core';
import { GenericPageNavHeader } from '@vertesia/ui/features';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useNavigate } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import type { ContentObjectTypeItem } from '@vertesia/common';
import { SortableHead } from '../../components/SortableHead';
import { ContentObjectRow } from './components/ContentObjectRow';
import { useContentObjectsListState } from './ContentObjectsListStateContext';
import { STATUS_VALUES, type FilterableField, type SortField } from './types';

const SCROLL_HISTORY_KEY = 'contentObjectsScrollTop';

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
    const state = window.history.state as
        | { data?: Record<string, unknown> }
        | null;
    const value = state?.data?.[SCROLL_HISTORY_KEY];
    return typeof value === 'number' ? value : undefined;
}

// Walk up from `start` to find the nearest scrollable ancestor (the element that
// actually scrolls when the user scrolls inside it). Falls back to documentElement
// when no overflow:auto/scroll ancestor exists.
function findScrollableElement(start: HTMLElement | null): HTMLElement | null {
    let current: HTMLElement | null = start;
    while (current && current !== document.body) {
        const overflowY = window.getComputedStyle(current).overflowY;
        const canScroll =
            (overflowY === 'auto' || overflowY === 'scroll') &&
            current.scrollHeight > current.clientHeight;
        if (canScroll) return current;
        current = current.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
}

export function ContentObjectsView() {
    const { t } = useUITranslation();
    const { client } = useUserSession();
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
        items,
        isLoading,
        isLoadingMore,
        loadMore,
        refetch,
        scrollTopRef,
    } = useContentObjectsListState();

    const [types, setTypes] = useState<ContentObjectTypeItem[]>([]);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollElRef = useRef<HTMLElement | null>(null);
    const restoreDoneRef = useRef(false);
    const deferredItems = useDeferredValue(items);

    useEffect(() => {
        client.store.types
            .list({ limit: 200 })
            .then(setTypes)
            .catch((err) => console.error('Failed to load content types:', err));
    }, [client]);

    useIntersectionObserver(loadMoreRef, loadMore, {
        threshold: 0.1,
        deps: [loadMore],
    });

    // Persist scroll on every event. The actual scrolling element may be an
    // ancestor of `scrollContainerRef` (e.g. AppLayout's outer overflow-y-auto),
    // so find it dynamically.
    //
    // Important: do NOT persist on cleanup. By the time cleanup runs, the route
    // has changed and the View's DOM is being detached — `el.scrollTop` reads as
    // 0 and would overwrite the saved value. The on-scroll listener already
    // persists every value during the user's scroll, so the latest position is
    // already saved when navigation happens.
    useEffect(() => {
        const el = findScrollableElement(scrollContainerRef.current);
        scrollElRef.current = el;
        if (!el) return;
        const onScroll = () => {
            const next = el.scrollTop;
            scrollTopRef.current = next;
            persistScrollTop(next);
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', onScroll);
        };
    }, [scrollTopRef]);

    // Restore scroll once the list has rendered. useLayoutEffect (not useEffect)
    // so the scroll happens before paint. A single rAF is not enough — the table
    // can take a few frames to lay out enough rows that scrollHeight reaches the
    // target. Poll up to maxAttempts frames waiting for sufficient scrollHeight.
    // Restore scroll once the list has rendered. useLayoutEffect runs after DOM
    // mutations but BEFORE paint — so doing the scroll synchronously here means
    // the user never sees the un-restored top-of-list flash. We only fall back
    // to rAF polling if scrollHeight isn't yet tall enough (rare — happens with
    // virtualized lists or async row mounting).
    useLayoutEffect(() => {
        if (restoreDoneRef.current) return;
        if (isLoading || items.length === 0) return;
        const target = readScrollTop() ?? scrollTopRef.current;
        if (target <= 0) {
            restoreDoneRef.current = true;
            return;
        }

        const trySync = (): boolean => {
            const el =
                scrollElRef.current ??
                findScrollableElement(scrollContainerRef.current);
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

        // scrollHeight too small right now — poll rAF until rows fill it out.
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
    }, [isLoading, items.length, scrollTopRef]);

    const handleSort = useCallback(
        (field: SortField) => {
            startTransition(() => {
                if (sortField === field) {
                    setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
                    return;
                }
                setSortField(field);
                setSortDir('asc');
            });
        },
        [sortField, setSortField, setSortDir],
    );

    const handleRowOpen = useCallback(
        (id: string) => {
            startTransition(() => {
                navigate(`/objects/${id}`);
            });
        },
        [navigate],
    );

    const addFilterValue = useCallback(
        (name: FilterableField, value: string, label: string) => {
            const placeholder =
                name === 'type' ? t('objects.filterType') : t('objects.filterStatus');
            const newOption: FilterOption = { value, label };
            startTransition(() => {
                setFilters((prev) => {
                    const existing = prev.find((f) => f.name === name);
                    if (!existing) {
                        return [
                            ...prev,
                            {
                                name,
                                placeholder,
                                type: 'select',
                                multiple: true,
                                value: [newOption],
                            },
                        ];
                    }
                    const currentValues = Array.isArray(existing.value) ? existing.value : [];
                    const alreadyHas = currentValues.some(
                        (v) => (typeof v === 'string' ? v : v.value) === value,
                    );
                    if (alreadyHas) return prev;
                    return prev.map((f) =>
                        f === existing
                            ? { ...f, value: [...(f.value as FilterOption[]), newOption] }
                            : f,
                    );
                });
            });
        },
        [t, setFilters],
    );

    const filterGroups: FilterGroup[] = useMemo(
        () => [
            {
                name: 'type',
                placeholder: t('objects.filterType'),
                type: 'select',
                multiple: true,
                options: [...types]
                    .map((typ) => ({ value: typ.id, label: typ.name }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
            },
            {
                name: 'status',
                placeholder: t('objects.filterStatus'),
                type: 'select',
                multiple: true,
                options: STATUS_VALUES.map((s) => ({
                    value: s,
                    label: t(`objects.status.${s}`),
                })).sort((a, b) => a.label.localeCompare(b.label)),
            },
        ],
        [types, t],
    );

    const tableRows = useMemo(
        () =>
            deferredItems.map((item) => (
                <ContentObjectRow
                    key={item.id}
                    item={item}
                    t={t}
                    onAddFilter={addFilterValue}
                    onOpen={handleRowOpen}
                />
            )),
        [deferredItems, t, addFilterValue, handleRowOpen],
    );

    const showEmpty = !isLoading && deferredItems.length === 0;

    return (
        <div className="flex flex-col h-full">
            <GenericPageNavHeader title={t('objects.title')} useDynamicBreadcrumbs={false} />
            <div className="flex flex-col gap-4 p-4 flex-1 min-h-0">
                <FilterProvider
                    filters={filters}
                    setFilters={setFilters}
                    filterGroups={filterGroups}
                >
                    <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-md">
                            <Input
                                value={query}
                                onChange={setQuery}
                                placeholder={t('objects.searchPlaceholder')}
                            />
                        </div>
                        <FilterBtn />
                        <FilterClear />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            isDisabled={isLoading}
                            alt={t('objects.refresh')}
                            className="ml-auto"
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
                                    field="name"
                                    label={t('objects.col.name')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                />
                                <SortableHead
                                    field="type"
                                    label={t('objects.col.type')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                />
                                <SortableHead
                                    field="status"
                                    label={t('objects.col.status')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                />
                                <SortableHead
                                    field="updated"
                                    label={t('objects.col.updated')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                />
                            </tr>
                        </THead>
                        <TBody isLoading={isLoading} columns={4} rows={6}>
                            {tableRows}
                        </TBody>
                    </Table>
                    {isLoadingMore && (
                        <div className="flex justify-center py-4">
                            <Spinner />
                        </div>
                    )}
                    <div ref={loadMoreRef} className="h-4 w-full" />
                    {showEmpty && (
                        <div className="text-center text-sm text-muted-foreground py-8">
                            {t('objects.empty')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
