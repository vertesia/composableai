import type { ComputedFacetResponse } from '@vertesia/common';
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

interface InteractionsFacetsNavProps {
    facets: ComputedFacetResponse;
    search: SearchInterface;
    env?: string | null;
    /**
     * Optional controlled filter state. When provided, the parent owns the filter list (and is
     * responsible for translating it into the search query via {@link useInteractionsFilterHandler}).
     * This lets other surfaces — e.g. per-row "quick filter" buttons in the table — add filters that
     * show up in the filter bar. When omitted, the component manages its own filter state internally.
     */
    filters?: BaseFilter[];
    setFilters?: React.Dispatch<React.SetStateAction<BaseFilter[]>>;
    filterGroups?: FilterGroup[];
}

// Hook to create filter groups for interactions
export function useInteractionsFilterGroups(facets: InteractionsFacetsNavProps['facets']): FilterGroup[] {
    void facets;
    const customFilterGroups: FilterGroup[] = [];

    // Add name filter as string type
    const nameFilterGroup = {
        name: 'name',
        placeholder: 'Name',
        type: 'text' as const,
        multiple: false,
    };
    customFilterGroups.push(nameFilterGroup);

    // Add prompt name filter as string type
    const promptNameFilterGroup = {
        name: 'prompt',
        placeholder: 'Prompt Name',
        type: 'text' as const,
        multiple: false,
    };
    customFilterGroups.push(promptNameFilterGroup);

    const ModelFilterGroup = {
        name: 'model',
        placeholder: 'Model',
        type: 'text' as const,
        multiple: false,
    };
    customFilterGroups.push(ModelFilterGroup);

    // Add tags filter as stringList type (allows custom input)
    const tagsFilterGroup = {
        name: 'tags',
        placeholder: 'Tags',
        type: 'stringList' as const,
        multiple: true,
    };
    customFilterGroups.push(tagsFilterGroup);

    return customFilterGroups;
}

// Hook to create filter change handler for interactions
export function useInteractionsFilterHandler(search: SearchInterface) {
    return (newFilters: BaseFilter[]) => {
        if (newFilters.length === 0) {
            search.clearFilters(true, true);

            return;
        }

        // Clear all filters first without defaults, then apply new ones
        search.clearFilters(false, false);

        newFilters.forEach((filter) => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;
                const filterValue = filterValueToQueryValue(filter);
                setSearchQueryValue(search, filterName, filterValue);
            }
        });

        void search.search(true);
    };
}

// Component for interactions filtering
export function InteractionsFacetsNav({
    facets,
    search,
    filters: controlledFilters,
    setFilters: controlledSetFilters,
    filterGroups: controlledFilterGroups,
}: InteractionsFacetsNavProps) {
    const [internalFilters, setInternalFilters] = useState<BaseFilter[]>([]);
    const internalFilterGroups = useInteractionsFilterGroups(facets);
    const handleFilterLogic = useInteractionsFilterHandler(search);

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
