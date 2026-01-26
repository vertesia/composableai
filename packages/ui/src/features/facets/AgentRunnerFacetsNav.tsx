import { Button, Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';
import { VStringFacet } from './utils/VStringFacet';
import { VUserFacet } from './utils/VUserFacet';
import { SearchInterface } from './utils/SearchInterface';
import { RefreshCw } from 'lucide-react';

interface AgentRunnerFacetsNavProps {
    facets: {
        statuses?: any[];
        initiated_by?: any[];
    };
    search: SearchInterface;
}

// Hook to create filter groups for agent runners
export function useAgentRunnerFilterGroups(facets: AgentRunnerFacetsNavProps['facets']): FilterGroup[] {
    const customFilterGroups: FilterGroup[] = [];

    if (facets.statuses) {
        const statusFilterGroup = VStringFacet({
            search: null as any, // This will be provided by the search context
            buckets: facets.statuses || [],
            name: 'status',
            placeholder: 'Status',
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.initiated_by) {
        const initiatedByFilterGroup = VUserFacet({
            buckets: facets.initiated_by || [],
            name: 'initiated_by',
            placeholder: 'Initiated By'
        });
        customFilterGroups.push(initiatedByFilterGroup);
    }

    const dateAfterFilterGroup = {
        name: 'start',
        placeholder: 'Started After',
        type: 'date' as const,
        multiple: false
    };
    customFilterGroups.push(dateAfterFilterGroup);

    const dateBeforeFilterGroup = {
        name: 'end',
        placeholder: 'Started Before',
        type: 'date' as const,
        multiple: false
    };
    customFilterGroups.push(dateBeforeFilterGroup);

    return customFilterGroups;
}

// Hook to create filter change handler for agent runners
export function useAgentRunnerFilterHandler(search: SearchInterface) {
    return (newFilters: BaseFilter[]) => {

        // Clear all filters first, then apply new ones
        search.clearFilters(false, false);

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;
                let filterValue;
                if (filter.multiple) {
                    filterValue = Array.isArray(filter.value)
                        ? filter.value.map((v: any) => typeof v === 'object' && v.value ? v.value : v)
                        : [typeof filter.value === 'object' && (filter.value as any).value ? (filter.value as any).value : filter.value];
                } else {
                    // Single value - don't wrap in array
                    filterValue = Array.isArray(filter.value) && filter.value[0] && typeof filter.value[0] === 'object'
                        ? (filter.value[0] as any).value
                        : Array.isArray(filter.value) && filter.value[0]
                            ? filter.value[0]
                            : filter.value;
                }

                search.query[filterName] = filterValue;
            }
        });

        search.search();
    };
}

// Legacy component for backward compatibility
export function AgentRunnerFacetsNav({ facets, search }: AgentRunnerFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const filterGroups = useAgentRunnerFilterGroups(facets);
    const handleFilterLogic = useAgentRunnerFilterHandler(search);

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        const newFilters = typeof value === 'function' ? value(filters) : value;
        setFilters(newFilters);
        handleFilterLogic(newFilters);
    };

    const handleRefetch = () => {
        search.search();
    };

    return (
        <FilterProvider
            filterGroups={filterGroups}
            filters={filters}
            setFilters={handleFilterChange}
        >
            <div className='flex justify-between mb-1'>
                <div className='flex gap-2 items-center'>
                    <FilterBtn />
                    <FilterBar />
                    <FilterClear />
                </div>
                <Button onClick={handleRefetch} variant='outline' title="Refresh">
                    <RefreshCw className="size-5" />
                </Button>
            </div>

        </FilterProvider>
    );
}
