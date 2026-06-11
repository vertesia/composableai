import type { FacetBucket } from '@vertesia/common';
import {
    type Filter as BaseFilter,
    FilterBar,
    FilterBtn,
    FilterClear,
    type FilterGroup,
    FilterProvider,
} from '@vertesia/ui/core';
import type { Dispatch, SetStateAction } from 'react';
import { VStringFacet } from './utils/VStringFacet';

interface ProcessDefinitionsFacetsNavProps {
    facets: {
        statuses?: FacetBucket[];
    };
    filters: BaseFilter[];
    setFilters: Dispatch<SetStateAction<BaseFilter[]>>;
}

// Hook to create filter groups for process definitions
export function useProcessDefinitionsFilterGroups(facets: ProcessDefinitionsFacetsNavProps['facets']): FilterGroup[] {
    const customFilterGroups: FilterGroup[] = [];

    customFilterGroups.push(
        VStringFacet({ buckets: facets.statuses || [], name: 'status', placeholder: 'Status', multiple: true }),
    );
    customFilterGroups.push({ name: 'name', placeholder: 'Name', type: 'text', multiple: false });

    return customFilterGroups;
}

/**
 * Controlled facet bar for the Process Definitions table. Buckets are computed by the
 * caller and passed in via `facets`; `filters`/`setFilters` are owned by the consuming
 * view, which applies them client-side.
 */
export function ProcessDefinitionsFacetsNav({ facets, filters, setFilters }: ProcessDefinitionsFacetsNavProps) {
    const filterGroups = useProcessDefinitionsFilterGroups(facets);

    return (
        <FilterProvider filterGroups={filterGroups} filters={filters} setFilters={setFilters}>
            <div className="flex items-center gap-2">
                <FilterBtn />
                <FilterBar />
                <FilterClear />
            </div>
        </FilterProvider>
    );
}
