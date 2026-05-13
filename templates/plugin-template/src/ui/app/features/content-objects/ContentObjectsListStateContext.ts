import {
    createContext,
    useContext,
    type Dispatch,
    type MutableRefObject,
    type SetStateAction,
} from 'react';
import type { Filter } from '@vertesia/ui/core';
import type { ContentObjectItem } from '@vertesia/common';
import type { SortDir } from '../../components/SortableHead';
import type { SortField } from './types';

export interface ContentObjectsListStateValue {
    // Search params
    query: string;
    setQuery: Dispatch<SetStateAction<string>>;
    filters: Filter[];
    setFilters: Dispatch<SetStateAction<Filter[]>>;
    sortField: SortField;
    setSortField: Dispatch<SetStateAction<SortField>>;
    sortDir: SortDir;
    setSortDir: Dispatch<SetStateAction<SortDir>>;

    // Data
    items: ContentObjectItem[];
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    loadMore: () => void;
    refetch: () => Promise<unknown>;

    // Scroll position (preserved across list/detail navigation)
    scrollTopRef: MutableRefObject<number>;
}

export const ContentObjectsListStateContext = createContext<
    ContentObjectsListStateValue | undefined
>(undefined);

export function useContentObjectsListState() {
    const ctx = useContext(ContentObjectsListStateContext);
    if (!ctx) {
        throw new Error(
            'useContentObjectsListState must be used inside ContentObjectsListStateProvider',
        );
    }
    return ctx;
}
