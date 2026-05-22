import { Button, Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { VInteractionFacet } from './utils/VInteractionFacet';
import type { EnrichedFacetBucket } from './utils/VInteractionFacet';
import { VStringFacet } from './utils/VStringFacet';
import { VUserFacet } from './utils/VUserFacet';
import { filterValueToQueryValue, SearchInterface, setSearchQueryValue } from './utils/SearchInterface';
import { RefreshCw } from 'lucide-react';
import type { FacetBucket } from '@vertesia/common';

interface AgentRunnerFacetsNavProps {
    facets: {
        statuses?: FacetBucket[];
        initiated_by?: FacetBucket[];
        interactions?: EnrichedFacetBucket[];
    };
    search: SearchInterface;
    actions?: React.ReactNode[];
    selectionCount?: number;
}

// Hook to create filter groups for agent runners
export function useAgentRunnerFilterGroups(facets: AgentRunnerFacetsNavProps['facets']): FilterGroup[] {
    const customFilterGroups: FilterGroup[] = [];

    customFilterGroups.push({
        name: 'id',
        placeholder: 'Agent Run ID',
        type: 'text',
        multiple: false
    });

    customFilterGroups.push(VInteractionFacet({
        buckets: facets.interactions || [],
        name: 'interaction',
        placeholder: 'Interaction',
    }));

    customFilterGroups.push(VStringFacet({
        buckets: facets.statuses || [],
        name: 'status',
        placeholder: 'Status',
    }));

    customFilterGroups.push(VUserFacet({
        buckets: facets.initiated_by || [],
        name: 'initiated_by',
        placeholder: 'Initiated By'
    }));

    customFilterGroups.push({
        name: 'start',
        placeholder: 'Started After',
        type: 'date' as const,
        multiple: false
    });

    customFilterGroups.push({
        name: 'end',
        placeholder: 'Started Before',
        type: 'date' as const,
        multiple: false
    });

    return customFilterGroups;
}

// Create filter change handler for agent runners
export function createAgentRunnerFilterHandler(search: SearchInterface) {
    return (newFilters: BaseFilter[]) => {

        // Clear all filters first, then apply new ones
        search.clearFilters(false, false);

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;
                const filterValue = filterValueToQueryValue(filter);
                setSearchQueryValue(search, filterName, filterValue);
            }
        });

        search.search();
    };
}

// Legacy component for backward compatibility
export function AgentRunnerFacetsNav({ facets, search, selectionCount, actions }: AgentRunnerFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const didMountRef = useRef(false);
    const skipNextSearchRef = useRef(
        typeof window !== 'undefined' && Boolean(new URLSearchParams(window.location.search).get('filters'))
    );
    const filterGroups = useAgentRunnerFilterGroups(facets);
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
        search.search();
    };

    return (
        <FilterProvider
            filterGroups={filterGroups}
            filters={filters}
            setFilters={setFilters}
        >
            <div className='gap-2 items-center w-full'>
                <div className='flex justify-between mb-1'>
                    <FilterBtn />
                    <div className='flex justify-end'>
                        {!selectionCount && (
                            <div className="flex items-center justify-between px-2 py-1">
                                <div className="text-sm text-muted-foreground">
                                    {search.initialized ? `${search.totalCount} agent runs` : 'Loading agent runs...'}
                                </div>
                            </div>
                        )}
                        {actions && actions.length > 0 ? (
                            <div className='flex items-center gap-2 mb-1 me-2'>
                                {actions.map((action, index) => (
                                    <div key={index}>{action}</div>
                                ))}
                            </div>
                        ) : null}
                        <Button onClick={handleRefetch} variant='outline' title="Refresh">
                            <RefreshCw className="size-5" />
                        </Button>
                    </div>
                </div>
                {filters.length > 0 && (
                    <div className='flex items-center gap-2 mb-1'>
                        <FilterBar />
                        <FilterClear />
                    </div>
                )}
            </div>

        </FilterProvider>
    );
}
