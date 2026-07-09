import type { AgentRunSearchHit } from '@vertesia/common';
import type { Filter } from '@vertesia/ui/core';
import { createContext, type Dispatch, type SetStateAction, useContext } from 'react';
import type { SortDir } from '../../../../../ui/app/components/SortableHead';
import type { SortField } from './types';

export interface ConversationsListStateValue {
    query: string;
    setQuery: Dispatch<SetStateAction<string>>;
    filters: Filter[];
    setFilters: Dispatch<SetStateAction<Filter[]>>;
    sortField: SortField;
    setSortField: Dispatch<SetStateAction<SortField>>;
    sortDir: SortDir;
    setSortDir: Dispatch<SetStateAction<SortDir>>;

    hits: AgentRunSearchHit[];
    isLoading: boolean;
    refetch: () => Promise<unknown>;

    scrollTopRef: React.MutableRefObject<number>;
}

export const ConversationsListStateContext = createContext<ConversationsListStateValue | undefined>(undefined);

export function useConversationsListState() {
    const ctx = useContext(ConversationsListStateContext);
    if (!ctx) {
        throw new Error('useConversationsListState must be used inside ConversationsListStateProvider');
    }
    return ctx;
}
