import type { FacetBucket } from '@vertesia/common';
import {
    type Filter as BaseFilter,
    Button,
    FilterBar,
    FilterBtn,
    FilterClear,
    type FilterGroup,
    FilterProvider,
} from '@vertesia/ui/core';
import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { filterValueToQueryValue, type SearchInterface, setSearchQueryValue } from './utils/SearchInterface';
import type { EnrichedFacetBucket } from './utils/VInteractionFacet';
import { VInteractionFacet } from './utils/VInteractionFacet';
import { VStringFacet } from './utils/VStringFacet';
import { VUserFacet } from './utils/VUserFacet';

interface AgentRunnerFacetsNavProps {
    facets: {
        statuses?: FacetBucket[];
        initiated_by?: FacetBucket[];
        interactions?: EnrichedFacetBucket[];
    };
    search: SearchInterface;
    actions?: React.ReactNode[];
    selectionCount?: number;
    /**
     * Optional controlled filter state. When provided, the parent owns the filter list so other
     * surfaces — e.g. per-row "quick filter" buttons in the table — can add filters that show up in
     * the filter bar. The filter→query translation still happens inside this component, so the parent
     * only needs a plain state setter. When omitted, the component manages its own filter state.
     */
    filters?: BaseFilter[];
    setFilters?: React.Dispatch<React.SetStateAction<BaseFilter[]>>;
    filterGroups?: FilterGroup[];
}

// Hook to create filter groups for agent runners
export function useAgentRunnerFilterGroups(facets: AgentRunnerFacetsNavProps['facets']): FilterGroup[] {
    const customFilterGroups: FilterGroup[] = [];

    customFilterGroups.push({
        name: 'id',
        placeholder: 'Agent Run ID',
        type: 'text',
        multiple: false,
    });

    customFilterGroups.push(
        VInteractionFacet({
            buckets: facets.interactions || [],
            name: 'interaction',
            placeholder: 'Interaction',
        }),
    );

    customFilterGroups.push(
        VStringFacet({
            buckets: facets.statuses || [],
            name: 'status',
            placeholder: 'Status',
        }),
    );

    customFilterGroups.push(
        VUserFacet({
            buckets: facets.initiated_by || [],
            name: 'initiated_by',
            placeholder: 'Initiated By',
        }),
    );

    customFilterGroups.push({
        name: 'start',
        placeholder: 'Started After',
        type: 'date' as const,
        multiple: false,
    });

    customFilterGroups.push({
        name: 'end',
        placeholder: 'Started Before',
        type: 'date' as const,
        multiple: false,
    });

    return customFilterGroups;
}

// Create filter change handler for agent runners
export function createAgentRunnerFilterHandler(search: SearchInterface) {
    return (newFilters: BaseFilter[]) => {
        // Clear all filters first, then apply new ones
        search.clearFilters(false, false);

        newFilters.forEach((filter) => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;
                const filterValue = filterValueToQueryValue(filter);
                setSearchQueryValue(search, filterName, filterValue);
            }
        });

        void search.search();
    };
}

// Legacy component for backward compatibility
export function AgentRunnerFacetsNav({
    facets,
    search,
    selectionCount,
    actions,
    filters: controlledFilters,
    setFilters: controlledSetFilters,
    filterGroups: controlledFilterGroups,
}: AgentRunnerFacetsNavProps) {
    const [internalFilters, setInternalFilters] = useState<BaseFilter[]>([]);
    const filters = controlledFilters ?? internalFilters;
    const setFilters = controlledSetFilters ?? setInternalFilters;
    const didMountRef = useRef(false);
    const skipNextSearchRef = useRef(
        typeof window !== 'undefined' && Boolean(new URLSearchParams(window.location.search).get('filters')),
    );
    const internalFilterGroups = useAgentRunnerFilterGroups(facets);
    const filterGroups = controlledFilterGroups ?? internalFilterGroups;
    const handleFilterLogic = useMemo(() => createAgentRunnerFilterHandler(search), [search]);

    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }

        if (skipNextSearchRef.current) {
            skipNextSearchRef.current = false;
            return;
        }

        handleFilterLogic(filters);
    }, [filters, handleFilterLogic]);

    const handleRefetch = () => {
        void search.search();
    };

    return (
        <FilterProvider filterGroups={filterGroups} filters={filters} setFilters={setFilters}>
            <div className="gap-2 items-center w-full">
                <div className="flex justify-between mb-1">
                    <FilterBtn />
                    <div className="flex justify-end">
                        {!selectionCount && (
                            <div className="flex items-center justify-between px-2 py-1">
                                <div className="text-sm text-muted-foreground">
                                    {search.initialized ? `${search.totalCount} agent runs` : 'Loading agent runs...'}
                                </div>
                            </div>
                        )}
                        {actions && actions.length > 0 ? (
                            <div className="flex items-center gap-2 mb-1 me-2">
                                {actions.map((action, index) => (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: list order is stable for this render
                                    <div key={index}>{action}</div>
                                ))}
                            </div>
                        ) : null}
                        <Button onClick={handleRefetch} variant="outline" title="Refresh">
                            <RefreshCw className="size-5" />
                        </Button>
                    </div>
                </div>
                {filters.length > 0 && (
                    <div className="flex items-center gap-2 mb-1">
                        <FilterBar />
                        <FilterClear />
                    </div>
                )}
            </div>
        </FilterProvider>
    );
}
