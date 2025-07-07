import { Filter as BaseFilter, FilterBar, FilterGroup } from '@vertesia/ui/core';
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
    textSearch?: string;
}

export function WorkflowExecutionsFacetsNav({
    facets,
    search,
    textSearch = 'Search by Workflow or Run ID'
}: WorkflowExecutionsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const customFilterGroups: FilterGroup[] = [];

    customFilterGroups.push({
        placeholder: textSearch,
        name: 'name',
        type: 'text',
        options: [],
    });

    if (facets.status) {
        const statusFilterGroup = VStringFacet({
            search,
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


    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        const newFilters = typeof value === 'function' ? value(filters) : value;
        if (newFilters.length === 0) {
            search.clearFilters();
            setFilters([]);
            return;
        }
        setFilters(newFilters);

        search.clearFilters(false);

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name.toLowerCase();
                const filterValue = filter.type === 'stringList'
                    ? filter.value.map(v => typeof v === 'string' ? v : v.value)
                    : Array.isArray(filter.value) && filter.value[0] && typeof filter.value[0] === 'object'
                        ? filter.value[0].value
                        : filter.value;

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

    return (
        <FilterBar
            filterGroups={customFilterGroups}
            filters={filters}
            setFilters={handleFilterChange}
        />
    );
}