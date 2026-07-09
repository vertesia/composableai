import type { ContentObjectItem } from '@vertesia/common';
import { type Filter, useDebounce, useFetch, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useMemo, useRef, useState } from 'react';
import type { SortDir } from '../../../../../ui/app/components/SortableHead';
import { ContentObjectsListStateContext, type ContentObjectsListStateValue } from './ContentObjectsListStateContext';
import { PAGE_SIZE, SORT_FIELD_MAP, type SortField } from './types';
import { getSelectValues } from './utils';

// FilterProvider re-applies URL filters on mount. When the list state survives
// route changes, that re-application can append duplicate chips. Dedupe writes.
function dedupeFilters(filters: Filter[]) {
    const seen = new Set<string>();
    const deduped: Filter[] = [];
    for (const filter of filters) {
        const normalizedValue = Array.isArray(filter.value)
            ? filter.value.map((entry) => (typeof entry === 'string' ? entry : `${entry.value}|${entry.label || ''}`))
            : [];
        const key = [filter.name, filter.type ?? '', filter.multiple ? 'multi' : 'single', ...normalizedValue].join(
            '::',
        );
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(filter);
    }
    return deduped;
}

interface ProviderProps {
    children: ReactNode;
}

export function ContentObjectsListStateProvider({ children }: ProviderProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();

    const [query, setQuery] = useState('');
    const [filtersState, setFiltersState] = useState<Filter[]>([]);
    const [sortField, setSortField] = useState<SortField>('updated');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [moreItems, setMoreItems] = useState<ContentObjectItem[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const scrollTopRef = useRef(0);

    const debouncedQuery = useDebounce(query, 300);

    const setFilters: Dispatch<SetStateAction<Filter[]>> = useCallback((value) => {
        setFiltersState((current) => {
            const next = typeof value === 'function' ? value(current) : value;
            return dedupeFilters(next);
        });
    }, []);

    const buildQuery = useCallback(() => {
        const typeIds = getSelectValues(filtersState, 'type');
        const statusValues = getSelectValues(filtersState, 'status');
        const trimmed = debouncedQuery.trim();
        return {
            ...(trimmed ? { full_text: trimmed } : {}),
            ...(typeIds.length ? { types: typeIds } : {}),
            ...(statusValues.length ? { status: statusValues } : {}),
        };
    }, [debouncedQuery, filtersState]);

    const sortPayload = useMemo(() => [{ field: SORT_FIELD_MAP[sortField], order: sortDir }], [sortField, sortDir]);

    const {
        data: firstPage,
        isLoading,
        refetch,
    } = useFetch<ContentObjectItem[]>(
        async () => {
            const result = await client.objects.search({
                query: buildQuery(),
                limit: PAGE_SIZE,
                offset: 0,
                sort: sortPayload,
            });
            return result.results ?? [];
        },
        {
            deps: [debouncedQuery, filtersState, sortField, sortDir],
            onSuccess: (results) => {
                setMoreItems([]);
                setHasMore(results.length >= PAGE_SIZE);
            },
            onError: (err) => {
                console.error('Content object search failed:', err);
                toast({ status: 'error', title: t('objects.searchError') });
            },
        },
    );

    const items = useMemo(() => [...(firstPage ?? []), ...moreItems], [firstPage, moreItems]);

    const loadMore = useCallback(() => {
        if (isLoadingMore || !hasMore || isLoading) return;
        setIsLoadingMore(true);
        const offset = items.length;
        client.objects
            .search({
                query: buildQuery(),
                limit: PAGE_SIZE,
                offset,
                sort: sortPayload,
            })
            .then((result) => {
                const results = result.results ?? [];
                setMoreItems((prev) => [...prev, ...results]);
                setHasMore(results.length >= PAGE_SIZE);
            })
            .catch((err) => {
                console.error('Load more failed:', err);
                toast({ status: 'error', title: t('objects.searchError') });
            })
            .finally(() => setIsLoadingMore(false));
    }, [client, buildQuery, sortPayload, items.length, isLoadingMore, isLoading, hasMore, toast, t]);

    const value: ContentObjectsListStateValue = useMemo(
        () => ({
            query,
            setQuery,
            filters: filtersState,
            setFilters,
            sortField,
            setSortField,
            sortDir,
            setSortDir,
            items,
            isLoading,
            isLoadingMore,
            hasMore,
            loadMore,
            refetch,
            scrollTopRef,
        }),
        [
            query,
            filtersState,
            setFilters,
            sortField,
            sortDir,
            items,
            isLoading,
            isLoadingMore,
            hasMore,
            loadMore,
            refetch,
        ],
    );

    return <ContentObjectsListStateContext.Provider value={value}>{children}</ContentObjectsListStateContext.Provider>;
}
