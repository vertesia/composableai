import { Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';
import { SearchInterface } from './utils/SearchInterface';

interface InteractionsFacetsNavProps {
    facets: {
        tags?: any[];
    };
    search: SearchInterface;
}

// Hook to create filter groups for interactions
export function useInteractionsFilterGroups(facets: InteractionsFacetsNavProps['facets']): FilterGroup[] {
    void facets;
    const customFilterGroups: FilterGroup[] = [];

    // Add name filter as string type
    const nameFilterGroup = {
        name: 'name',
        placeholder: 'Filter by Name',
        type: 'text' as const,
        multiple: false
    };
    customFilterGroups.push(nameFilterGroup);

    // Add prompt name filter as string type
    const promptNameFilterGroup = {
        name: 'prompt',
        placeholder: 'Filter by Prompt Name',
        type: 'text' as const,
        multiple: false
    };
    customFilterGroups.push(promptNameFilterGroup);

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
            // Clear filters without applying defaults - user wants to remove all filters
            search.clearFilters(true, false);
            return;
        }

        // Clear all filters first without defaults, then apply new ones
        search.clearFilters(false, false);

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;
                let filterValue;
                if (filter.type === 'stringList') {
                    filterValue = filter.value.map(v => typeof v === 'string' ? v : v.value);
                } else if (filter.multiple) {
                    filterValue = Array.isArray(filter.value)
                        ? filter.value.map((v: any) => typeof v === 'object' && v.value ? v.value : v)
                        : [typeof filter.value === 'object' && (filter.value as any).value ? (filter.value as any).value : filter.value];
                } else {
                    // Single value - don't wrap in array
                    filterValue = Array.isArray(filter.value) && filter.value[0] && typeof filter.value[0] === 'object'
                        ? (filter.value[0] as any).value
                        : Array.isArray(filter.value) && filter.value[0]
                            ? filter.value[0]
                            : filter.value;
                }

                search.query[filterName] = filterValue;
            }
        });

        search.search();
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