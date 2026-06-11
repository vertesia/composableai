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

interface WorkflowRulesFacetsNavProps {
    facets: {
        endpoints?: FacetBucket[];
        input_types?: FacetBucket[];
    };
    filters: BaseFilter[];
    setFilters: Dispatch<SetStateAction<BaseFilter[]>>;
}

// Hook to create filter groups for workflow rules
export function useWorkflowRulesFilterGroups(facets: WorkflowRulesFacetsNavProps['facets']): FilterGroup[] {
    const customFilterGroups: FilterGroup[] = [];

    void facets;

    customFilterGroups.push({ name: 'name', placeholder: 'Name', type: 'text', multiple: false });

    return customFilterGroups;
}

/**
 * Controlled facet bar for the Workflow Rules table. Buckets are computed by the caller and
 * passed in via `facets`; `filters`/`setFilters` are owned by the consuming view, which
 * applies them client-side (the `/rules` endpoint returns all rules with no server filters).
 */
export function WorkflowRulesFacetsNav({ facets, filters, setFilters }: WorkflowRulesFacetsNavProps) {
    const filterGroups = useWorkflowRulesFilterGroups(facets);

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
