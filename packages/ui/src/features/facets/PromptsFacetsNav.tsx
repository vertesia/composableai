import type { ComputedFacetResponse, FacetBucket, PromptSearchQuery } from '@vertesia/common';
import {
    type Filter as BaseFilter,
    FilterBar,
    FilterBtn,
    FilterClear,
    type FilterGroup,
    FilterProvider,
} from '@vertesia/ui/core';
import { useState } from 'react';
import {
    createSearchQueryKeyGuard,
    filterValueToQueryValue,
    type SearchInterface,
    setSearchQueryValue,
} from './utils/SearchInterface';

const promptFilterNames = ['name', 'role', 'tags'] as const satisfies readonly (keyof PromptSearchQuery)[];
const isPromptFilterName = createSearchQueryKeyGuard<PromptSearchQuery>(promptFilterNames);

interface PromptsFacetsNavProps {
    /**
     * The facet response as the endpoint publishes it: `total` plus one entry per facet the caller
     * asked for. The names are chosen per request, so the buckets are narrowed below rather than
     * declared here — the previous `{ role, status, tags }` shape named facets this component never
     * requests and could not describe a caller that asks for a different one.
     */
    facets: ComputedFacetResponse;
    search: SearchInterface<PromptSearchQuery>;
    /**
     * Optional controlled filter state. When provided, the parent owns the filter list (and is
     * responsible for translating it into the search query via {@link usePromptsFilterHandler}). This
     * lets other surfaces — e.g. per-row "quick filter" buttons in the table — add filters that show
     * up in the filter bar. When omitted, the component manages its own filter state internally.
     */
    filters?: BaseFilter[];
    setFilters?: React.Dispatch<React.SetStateAction<BaseFilter[]>>;
    filterGroups?: FilterGroup[];
}

function facetBuckets(facets: ComputedFacetResponse, name: string): FacetBucket[] {
    const value = facets[name];
    return Array.isArray(value) ? (value as FacetBucket[]) : [];
}

// Hook to create filter groups for prompts
export function usePromptsFilterGroups(facets: PromptsFacetsNavProps['facets']): FilterGroup[] {
    const roleBuckets = facetBuckets(facets, 'role');
    const customFilterGroups: FilterGroup[] = [];

    // Add name filter as text type
    const nameFilterGroup = {
        name: 'name',
        placeholder: 'Name',
        type: 'text' as const,
        multiple: false,
    };
    customFilterGroups.push(nameFilterGroup);

    // Add role filter as select type if role facets are available
    if (roleBuckets.length > 0) {
        const rolesFilterGroup = {
            name: 'role',
            placeholder: 'Role',
            type: 'select' as const,
            options: roleBuckets.map((facet) => ({
                label: facet._id,
                value: facet._id,
                count: facet.count,
            })),
        };
        customFilterGroups.push(rolesFilterGroup);
    }

    // Add tags filter as stringList type (suggestions from facets, allows custom input)
    const tagsFilterGroup = {
        name: 'tags',
        placeholder: 'Tags',
        type: 'stringList' as const,
        multiple: true,
        options: facetBuckets(facets, 'tags').map((facet) => ({
            label: facet._id,
            value: facet._id,
        })),
    };
    customFilterGroups.push(tagsFilterGroup);

    return customFilterGroups;
}

// Hook to create filter change handler for prompts
export function usePromptsFilterHandler(search: SearchInterface<PromptSearchQuery>) {
    return (newFilters: BaseFilter[]) => {
        if (newFilters.length === 0) {
            // Clear filters without applying defaults - user wants to remove all filters
            search.clearFilters(true, false);
            return;
        }

        // Clear all filters first without defaults, then apply new ones
        search.clearFilters(false, false);

        newFilters.forEach((filter) => {
            if (filter.value && filter.value.length > 0) {
                if (!isPromptFilterName(filter.name)) {
                    return;
                }
                const filterName = filter.name;
                const filterValue = filterValueToQueryValue(filter);
                setSearchQueryValue(search, filterName, filterValue);
            }
        });

        void search.search();
    };
}

// Component for prompts filtering
export function PromptsFacetsNav({
    facets,
    search,
    filters: controlledFilters,
    setFilters: controlledSetFilters,
    filterGroups: controlledFilterGroups,
}: PromptsFacetsNavProps) {
    const [internalFilters, setInternalFilters] = useState<BaseFilter[]>([]);
    const internalFilterGroups = usePromptsFilterGroups(facets);
    const handleFilterLogic = usePromptsFilterHandler(search);

    // Controlled when the parent supplies both the filter list and its setter; otherwise self-managed.
    const isControlled = controlledFilters !== undefined && controlledSetFilters !== undefined;
    const filters = isControlled ? controlledFilters : internalFilters;
    const filterGroups = controlledFilterGroups ?? internalFilterGroups;

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        if (isControlled) {
            // The parent's setter is expected to also run the filter→query translation.
            controlledSetFilters(value);
            return;
        }
        const newFilters = typeof value === 'function' ? value(internalFilters) : value;
        setInternalFilters(newFilters);
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
