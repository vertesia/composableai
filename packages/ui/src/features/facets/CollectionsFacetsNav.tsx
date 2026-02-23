import { Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';
import { useTypeRegistry } from '../store/types/TypeRegistryProvider.js';
import { SearchInterface } from './utils/SearchInterface';

interface CollectionsFacetsNavProps {
    facets: {
        type?: any[];
        dynamic?: any[];
    };
    search: SearchInterface;
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
        multiple: false
    };
    customFilterGroups.push(nameFilterGroup);

    // add type filter as select type
    if (typeRegistry) {
        const typeOptions = typeRegistry.types.map(type => {
            return {
                label: type.name,
                value: type.id
            }
        });
        const typeFilterGroup = {
            name: 'types',
            placeholder: 'Type',
            type: 'select' as const,
            multiple: true,
            options: typeOptions,
            filterBy: (value: string, searchText: string) => {
                const option = typeOptions.find(opt => opt.value === value);
                return option?.label?.toLowerCase().includes(searchText.toLowerCase()) ?? false;
            }
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

// Component for collections filtering
export function CollectionsFacetsNav({ facets, search }: CollectionsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const filterGroups = useCollectionsFilterGroups(facets);
    const handleFilterLogic = useCollectionsFilterHandler(search);

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