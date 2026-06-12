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
import { VUserFacet } from './utils/VUserFacet';

interface ProcessRunsFacetsNavProps {
    facets: {
        statuses?: FacetBucket[];
        started_by?: FacetBucket[];
        run_type?: FacetBucket[];
        processes?: FacetBucket[];
    };
    filters: BaseFilter[];
    setFilters: Dispatch<SetStateAction<BaseFilter[]>>;
}

// Hook to create filter groups for process runs
export function useProcessRunsFilterGroups(facets: ProcessRunsFacetsNavProps['facets']): FilterGroup[] {
    const customFilterGroups: FilterGroup[] = [];

    customFilterGroups.push(
        VStringFacet({ buckets: facets.statuses || [], name: 'status', placeholder: 'Status', multiple: true }),
    );
    customFilterGroups.push(
        VUserFacet({ buckets: facets.started_by || [], name: 'started_by', placeholder: 'Started By' }),
    );
    customFilterGroups.push(
        VStringFacet({ buckets: facets.run_type || [], name: 'run_type', placeholder: 'Mode', multiple: true }),
    );
    customFilterGroups.push(
        VStringFacet({ buckets: facets.processes || [], name: 'process', placeholder: 'Process', multiple: true }),
    );
    customFilterGroups.push({ name: 'start', placeholder: 'Started After', type: 'date', multiple: false });
    customFilterGroups.push({ name: 'end', placeholder: 'Started Before', type: 'date', multiple: false });

    return customFilterGroups;
}

/**
 * Controlled facet bar for the Process Runs table. Buckets are computed by the caller and
 * passed in via `facets`; `filters`/`setFilters` are owned by the consuming view, which
 * applies them client-side.
 */
export function ProcessRunsFacetsNav({ facets, filters, setFilters }: ProcessRunsFacetsNavProps) {
    const filterGroups = useProcessRunsFilterGroups(facets);

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
