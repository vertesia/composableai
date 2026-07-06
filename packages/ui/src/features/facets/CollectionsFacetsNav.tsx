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
import { useTypeRegistry } from '../store/types/TypeRegistryProvider.js';
import { filterValueToQueryValue, type SearchInterface, setSearchQueryValue } from './utils/SearchInterface';

interface CollectionsFacetsNavProps {
    facets: {
        type?: FacetBucket[];
        dynamic?: FacetBucket[];
    };
    search: SearchInterface;
    /**
     * Optional controlled filter state. When provided, the parent owns the filter list (and is
     * responsible for translating it into the search query via {@link useCollectionsFilterHandler}).
     * This lets other surfaces — e.g. per-row "quick filter" buttons in the table — add filters that
     * show up in the filter bar. When omitted, the component manages its own filter state internally.
     */
    filters?: BaseFilter[];
    setFilters?: React.Dispatch<React.SetStateAction<BaseFilter[]>>;
    filterGroups?: FilterGroup[];
}

// Hook to create filter groups for collections
export function useCollectionsFilterGroups(facets: CollectionsFacetsNavProps['facets']): FilterGroup[] {
    void facets;
    const { registry: typeRegistry } = useTypeRegistry();

    const customFilterGroups: FilterGroup[] = [];

    // Add name filter as text type
    const nameFilterGroup = {
        name: 'name',
        placeholder: 'Name',
        type: 'text' as const,
        multiple: false,
    };
    customFilterGroups.push(nameFilterGroup);

    // add type filter as select type
    if (typeRegistry) {
        const typeOptions = typeRegistry.types.map((type) => {
            return {
                label: type.name,
                value: type.id,
            };
        });
        const typeFilterGroup = {
            name: 'types',
            placeholder: 'Type',
            type: 'select' as const,
            multiple: true,
            options: typeOptions,
            filterBy: (value: string, searchText: string) => {
                const option = typeOptions.find((opt) => opt.value === value);
                return option?.label?.toLowerCase().includes(searchText.toLowerCase()) ?? false;
            },
        };
        customFilterGroups.push(typeFilterGroup);
    }

    return customFilterGroups;
}

// Hook to create filter change handler for collections
export function useCollectionsFilterHandler(search: SearchInterface) {
    return (newFilters: BaseFilter[]) => {
        if (newFilters.length === 0) {
            // Clear filters without applying defaults - user wants to remove all filters
            search.clearFilters(true);
            return;
        }

        // Clear all filters first, then apply new ones
        search.clearFilters(false);

        newFilters.forEach((filter) => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;
                const filterValue = filterValueToQueryValue(filter);
                setSearchQueryValue(search, filterName, filterValue);
            }
        });

        void search.search();
    };
}

// Component for collections filtering
export function CollectionsFacetsNav({
    facets,
    search,
    filters: controlledFilters,
    setFilters: controlledSetFilters,
    filterGroups: controlledFilterGroups,
}: CollectionsFacetsNavProps) {
    const [internalFilters, setInternalFilters] = useState<BaseFilter[]>([]);
    const internalFilterGroups = useCollectionsFilterGroups(facets);
    const handleFilterLogic = useCollectionsFilterHandler(search);

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
