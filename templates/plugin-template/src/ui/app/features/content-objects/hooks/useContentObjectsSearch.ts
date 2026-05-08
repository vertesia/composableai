import { useCallback, useMemo, useState } from 'react';
import { useFetch, useToast, type Filter } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import type { ContentObjectItem } from '@vertesia/common';
import type { SortDir } from '../../../components/SortableHead';
import { PAGE_SIZE, SORT_FIELD_MAP, type SortField } from '../types';
import { getSelectValues } from '../utils';

interface UseContentObjectsSearchArgs {
    debouncedQuery: string;
    filters: Filter[];
    sortField: SortField;
    sortDir: SortDir;
}

export function useContentObjectsSearch({
    debouncedQuery,
    filters,
    sortField,
    sortDir,
}: UseContentObjectsSearchArgs) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();

    const [moreItems, setMoreItems] = useState<ContentObjectItem[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const buildQuery = useCallback(() => {
        const typeIds = getSelectValues(filters, 'type');
        const statusValues = getSelectValues(filters, 'status');
        const trimmed = debouncedQuery.trim();
        return {
            ...(trimmed ? { full_text: trimmed } : {}),
            ...(typeIds.length ? { types: typeIds } : {}),
            ...(statusValues.length ? { status: statusValues } : {}),
        };
    }, [debouncedQuery, filters]);

    const sortPayload = useMemo(
        () => [{ field: SORT_FIELD_MAP[sortField], order: sortDir }],
        [sortField, sortDir],
    );

    const { data: firstPage, isLoading, refetch } = useFetch<ContentObjectItem[]>(
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
            deps: [debouncedQuery, filters, sortField, sortDir],
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
    }, [
        client,
        buildQuery,
        sortPayload,
        items.length,
        isLoadingMore,
        isLoading,
        hasMore,
        toast,
        t,
    ]);

    return {
        items,
        isLoading,
        isLoadingMore,
        hasMore,
        loadMore,
        refetch,
    };
}
