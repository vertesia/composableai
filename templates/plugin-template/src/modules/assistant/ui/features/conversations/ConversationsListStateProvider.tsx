import type { AgentRunResponse, AgentRunSearchHit, AgentRunStatus } from '@vertesia/common';
import { type Filter, useDebounce, useFetch, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useMemo, useRef, useState } from 'react';
import type { SortDir } from '../../../../../ui/app/components/SortableHead';
import { ConversationsListStateContext, type ConversationsListStateValue } from './ConversationsListStateContext';
import { PAGE_SIZE, type SortField } from './types';
import { getSelectValues } from './utils';

// Normalize the `list` response to the `search` response shape so the View
// always sees a single type (AgentRunSearchHit).
function toHit(run: AgentRunResponse): AgentRunSearchHit {
    const isAgent = run.run_kind === 'agent';
    const toIso = (v: unknown): string => {
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'string') return v;
        return '';
    };
    return {
        id: run.id,
        score: 0,
        interaction: isAgent ? run.interaction : undefined,
        run_kind: run.run_kind,
        run_type: run.run_type,
        interaction_name: isAgent ? run.interaction_name : undefined,
        status: run.status,
        activity_state: run.activity_state,
        started_at: toIso(run.started_at),
        completed_at: toIso(run.completed_at) || undefined,
        started_by: run.started_by,
        title: run.title,
        topic: isAgent ? run.topic : undefined,
        interactive: isAgent ? (run.interactive ?? false) : false,
        created_at: toIso(run.created_at),
        updated_at: toIso(run.updated_at),
    };
}

// FilterProvider re-applies URL filters on mount; dedupe writes so back-nav
// doesn't multiply chips.
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

export function ConversationsListStateProvider({ children }: ProviderProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();

    const [query, setQuery] = useState('');
    const [filtersState, setFiltersState] = useState<Filter[]>([]);
    const [sortField, setSortField] = useState<SortField>('started');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const scrollTopRef = useRef(0);

    const debouncedQuery = useDebounce(query, 300);

    const setFilters: Dispatch<SetStateAction<Filter[]>> = useCallback((value) => {
        setFiltersState((current) => {
            const next = typeof value === 'function' ? value(current) : value;
            return dedupeFilters(next);
        });
    }, []);

    // Backend re-runs on query / status / single-agent / sort changes.
    // - With query: `agents.search` (full-text, sort=relevance — `sort` ignored by backend
    //   but we still refetch so the user gets a loading indicator).
    // - Without query: `agents.list` (supports sort by `started_at` / `updated_at`; for other
    //   sort fields, the loaded page is sorted client-side downstream).
    // Multi-agent filter is client-side (backend `interaction` param is single-valued).
    const { data, isLoading, refetch } = useFetch<AgentRunSearchHit[]>(
        async () => {
            const trimmed = debouncedQuery.trim();
            const statusValues = getSelectValues(filtersState, 'status') as AgentRunStatus[];
            const agentValues = getSelectValues(filtersState, 'agent');
            if (trimmed) {
                const response = await client.agents.search({
                    query: trimmed,
                    ...(statusValues.length ? { status: statusValues } : {}),
                    ...(agentValues.length === 1 ? { interaction: agentValues[0] } : {}),
                    limit: PAGE_SIZE,
                });
                return response.hits;
            }
            const backendSort: 'started_at' | 'updated_at' | undefined =
                sortField === 'started' ? 'started_at' : undefined;
            const response = await client.agents.list({
                ...(statusValues.length === 1 ? { status: statusValues[0] } : {}),
                ...(agentValues.length === 1 ? { interaction: agentValues[0] } : {}),
                ...(backendSort ? { sort: backendSort, order: sortDir } : {}),
                limit: PAGE_SIZE,
            });
            return response.items.map(toHit);
        },
        {
            deps: [debouncedQuery, filtersState, sortField, sortDir],
            onError: (err) => {
                console.error('Conversations fetch failed:', err);
                toast({ status: 'error', title: t('conversations.searchError') });
            },
        },
    );

    const hits = useMemo(() => data ?? [], [data]);

    const value: ConversationsListStateValue = useMemo(
        () => ({
            query,
            setQuery,
            filters: filtersState,
            setFilters,
            sortField,
            setSortField,
            sortDir,
            setSortDir,
            hits,
            isLoading,
            refetch,
            scrollTopRef,
        }),
        [query, filtersState, setFilters, sortField, sortDir, hits, isLoading, refetch],
    );

    return <ConversationsListStateContext.Provider value={value}>{children}</ConversationsListStateContext.Provider>;
}
