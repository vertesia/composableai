import type { FacetBucket } from '@vertesia/common';
import {
    type Filter as BaseFilter,
    FilterBar,
    FilterBtn,
    FilterClear,
    type FilterGroup,
    FilterProvider,
} from '@vertesia/ui/core';
import { useState } from 'react';
import { filterValueToQueryValue, type SearchInterface, setSearchQueryValue } from './utils/SearchInterface';
import { VStringFacet } from './utils/VStringFacet';
import { VUserFacet } from './utils/VUserFacet';

interface WorkflowExecutionsFacetsNavProps {
    facets: {
        status?: FacetBucket[];
        initiated_by?: FacetBucket[];
    };
    search: SearchInterface;
}

// Hook to create filter groups for workflow executions
export function useWorkflowExecutionsFilterGroups(facets: WorkflowExecutionsFacetsNavProps['facets']): FilterGroup[] {
    const customFilterGroups: FilterGroup[] = [];

    customFilterGroups.push({
        placeholder: 'Workflow Name or Workflow Run ID',
        name: 'name',
        type: 'text',
        options: [],
    });

    if (facets.status) {
        const statusFilterGroup = VStringFacet({
            buckets: facets.status || [],
            name: 'status',
            placeholder: 'Status',
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.initiated_by) {
        const initiatedByFilterGroup = VUserFacet({
            buckets: facets.initiated_by || [],
            name: 'initiated_by',
            placeholder: 'Initiated By',
        });
        customFilterGroups.push(initiatedByFilterGroup);
    }

    const dateAfterFilterGroup = {
        name: 'start',
        placeholder: 'Date After',
        type: 'date' as const,
        multiple: false,
    };
    customFilterGroups.push(dateAfterFilterGroup);

    const dateBeforeFilterGroup = {
        name: 'end',
        placeholder: 'Date Before',
        type: 'date' as const,
        multiple: false,
    };
    customFilterGroups.push(dateBeforeFilterGroup);

    const hasReportedErrorsFilterGroup = {
        name: 'has_reported_errors',
        placeholder: 'Has Reported Errors',
        type: 'select' as const,
        multiple: false,
        options: [
            { label: 'Yes', value: 'true' },
            { label: 'No', value: 'false' },
        ],
    };
    customFilterGroups.push(hasReportedErrorsFilterGroup);

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

        newFilters.forEach((filter) => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;
                const filterValue = filterValueToQueryValue(filter);

                if (filterName === 'name') {
                    setSearchQueryValue(search, 'search_term', filterValue);
                    setSearchQueryValue(search, 'name', filterValue);
                } else if (filterName === 'has_reported_errors') {
                    // Convert string "true"/"false" to boolean
                    const stringValue = Array.isArray(filterValue) ? filterValue[0] : filterValue;
                    // Only set the filter if we have a valid value
                    if (stringValue === 'true' || stringValue === 'false') {
                        setSearchQueryValue(search, filterName, stringValue === 'true');
                    }
                } else {
                    setSearchQueryValue(search, filterName, filterValue);
                }
            }
        });

        void search.search();
    };
}

// Legacy component for backward compatibility
export function WorkflowExecutionsFacetsNav({ facets, search }: WorkflowExecutionsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const filterGroups = useWorkflowExecutionsFilterGroups(facets);
    const handleFilterLogic = useWorkflowExecutionsFilterHandler(search);

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        const newFilters = typeof value === 'function' ? value(filters) : value;
        setFilters(newFilters);
        handleFilterLogic(newFilters);
    };

    return (
        <FilterProvider filterGroups={filterGroups} filters={filters} setFilters={handleFilterChange}>
            <div className="flex gap-2 items-center">
                <FilterBtn />
                <FilterBar />
                <FilterClear />
            </div>
        </FilterProvider>
    );
}
