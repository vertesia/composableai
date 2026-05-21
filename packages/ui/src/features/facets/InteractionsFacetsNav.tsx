import { Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import type { ComputedFacetResponse } from '@vertesia/common';
import { useState } from 'react';
import { filterValueToQueryValue, SearchInterface, setSearchQueryValue } from './utils/SearchInterface';

interface InteractionsFacetsNavProps {
    facets: ComputedFacetResponse;
    search: SearchInterface;
    env?: string | null;
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
        multiple: false
    };
    customFilterGroups.push(nameFilterGroup);

    // Add prompt name filter as string type
    const promptNameFilterGroup = {
        name: 'prompt',
        placeholder: 'Prompt Name',
        type: 'text' as const,
        multiple: false
    };
    customFilterGroups.push(promptNameFilterGroup);

    const ModelFilterGroup = {
        name: 'model',
        placeholder: 'Model',
        type: 'text' as const,
        multiple: false
    };
    customFilterGroups.push(ModelFilterGroup);

    // Add tags filter as stringList type (allows custom input)
    const tagsFilterGroup = {
        name: 'tags',
        placeholder: 'Tags',
        type: 'stringList' as const,
        multiple: true
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

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;
                const filterValue = filterValueToQueryValue(filter);
                setSearchQueryValue(search, filterName, filterValue);
            }
        });

        search.search(true);
    };
}

// Component for interactions filtering
export function InteractionsFacetsNav({ facets, search }: InteractionsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const filterGroups = useInteractionsFilterGroups(facets);
    const handleFilterLogic = useInteractionsFilterHandler(search);

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
