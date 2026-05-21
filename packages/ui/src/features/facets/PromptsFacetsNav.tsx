import { Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';
import { filterValueToQueryValue, SearchInterface, setSearchQueryValue } from './utils/SearchInterface';
import type { FacetBucket } from '@vertesia/common';

interface PromptsFacetsNavProps {
    facets: {
        role?: FacetBucket[];
        status?: FacetBucket[];
        tags?: FacetBucket[];
    };
    search: SearchInterface;
}

// Hook to create filter groups for prompts
export function usePromptsFilterGroups(facets: PromptsFacetsNavProps['facets']): FilterGroup[] {
    void facets;
    const customFilterGroups: FilterGroup[] = [];

    // Add name filter as text type
    const nameFilterGroup = {
        name: 'name',
        placeholder: 'Name',
        type: 'text' as const,
        multiple: false
    };
    customFilterGroups.push(nameFilterGroup);

    // Add role filter as select type if role facets are available
    if (facets.role && facets.role.length > 0) {
        const rolesFilterGroup = {
            name: 'role',
            placeholder: 'Role',
            type: 'select' as const,
            options: facets.role.map((facet) => ({
                label: facet._id,
                value: facet._id,
                count: facet.count
            })),
        };
        customFilterGroups.push(rolesFilterGroup);
    }

    return customFilterGroups;
}

// Hook to create filter change handler for prompts
export function usePromptsFilterHandler(search: SearchInterface) {
    return (newFilters: BaseFilter[]) => {
        if (newFilters.length === 0) {
            // Clear filters without applying defaults - user wants to remove all filters
            search.clearFilters(true, false);
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

        search.search();
    };
}

// Component for prompts filtering
export function PromptsFacetsNav({ facets, search }: PromptsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const filterGroups = usePromptsFilterGroups(facets);
    const handleFilterLogic = usePromptsFilterHandler(search);

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
