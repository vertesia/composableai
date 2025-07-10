import { Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';
import { VStringFacet } from './VStringFacet';
import { VUserFacet } from './VUserFacet';
import { SearchInterface } from './VFacetsNav';

interface WorkflowExecutionsFacetsNavProps {
    facets: {
        status?: any[];
        initiated_by?: any[];
    };
    search: SearchInterface;
}

// Hook to create filter groups for workflow executions
export function useWorkflowExecutionsFilterGroups(facets: WorkflowExecutionsFacetsNavProps['facets']): FilterGroup[] {
    const customFilterGroups: FilterGroup[] = [];

    customFilterGroups.push({
        placeholder: 'Search by Workflow or Run ID',
        name: 'name',
        type: 'text',
        options: [],
    });

    if (facets.status) {
        const statusFilterGroup = VStringFacet({
            search: null as any, // This will be provided by the search context
            buckets: facets.status || [],
            name: 'Status'
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.initiated_by) {
        const initiatedByFilterGroup = VUserFacet({
            buckets: facets.initiated_by || [],
            name: 'User'
        });
        customFilterGroups.push(initiatedByFilterGroup);
    }

    const dateAfterFilterGroup = {
        name: 'start',
        placeholder: 'Date After',
        type: 'date' as const,
        multiple: false
    };
    customFilterGroups.push(dateAfterFilterGroup);

    const dateBeforeFilterGroup = {
        name: 'end',
        placeholder: 'Date Before',
        type: 'date' as const,
        multiple: false
    };
    customFilterGroups.push(dateBeforeFilterGroup);

    return customFilterGroups;
}

// Hook to create filter change handler for workflow executions
export function useWorkflowExecutionsFilterHandler(search: SearchInterface) {
    return (newFilters: BaseFilter[]) => {
        if (newFilters.length === 0) {
            search.clearFilters();
            return;
        }

        search.clearFilters(false);

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;
                let filterValue;
                if (filter.type === 'stringList') {
                    filterValue = filter.value.map(v => typeof v === 'string' ? v : v.value);
                } else if (filter.multiple) {
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

                if (filterName === 'name') {
                    search.query.search_term = filterValue;
                    search.query.name = filterValue;
                } else {
                    search.query[filterName] = filterValue;
                }
            }
        });

        search.search();
    };
}

// Legacy component for backward compatibility
export function WorkflowExecutionsFacetsNav({
    facets,
    search,
}: WorkflowExecutionsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const filterGroups = useWorkflowExecutionsFilterGroups(facets);
    const handleFilterLogic = useWorkflowExecutionsFilterHandler(search);

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        const newFilters = typeof value === 'function' ? value(filters) : value;
        setFilters(newFilters);
        handleFilterLogic(newFilters);
    };

    return (
        <FilterProvider
            filterGroups={filterGroups}
            filters={filters}
            setFilters={handleFilterChange}
        >
            <div className="flex gap-2 items-center">
                <FilterBtn />
                <FilterBar />
                <FilterClear />
            </div>
        </FilterProvider>
    );
}