import { Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';

export interface SearchInterface {
    getFilterValue(name: string): any;
    setFilterValue(name: string, value: any): void;
    clearFilters(autoSearch?: boolean, applyDefaults?: boolean): void;
    search(): Promise<boolean | undefined>;
    readonly isRunning: boolean;
    query: Record<string, any>;
}

interface FacetsNavProps {
    facets: any;
    search: SearchInterface;
    textSearch?: string;
}
export function VFacetsNav({ search, textSearch = '' }: FacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const customFilterGroups: FilterGroup[] = [];

    if (textSearch) {
        customFilterGroups.push({
            placeholder: textSearch,
            name: 'name',
            type: 'text',
            options: [],
        });
    }

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {

        const newFilters = typeof value === 'function' ? value(filters) : value;
        if (newFilters.length === 0) {
            search.clearFilters();
            setFilters([]);
            return;
        }
        setFilters(newFilters);

        // Reset the actual query before reapplying filters. Otherwise the removed filters remain.
        search.clearFilters(false);

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name.toLowerCase();
                const filterValue = filter.type === 'stringList' 
                    ? filter.value.map(v => typeof v === 'string' ? v : v.value) 
                    : Array.isArray(filter.value) && filter.value[0] && typeof filter.value[0] === 'object' 
                        ? filter.value[0].value 
                        : filter.value;

                switch (filterName) {
                    case 'name':
                        search.query.search_term = filterValue;
                        search.query.name = filterValue;
                        break;
                    default:
                        search.query[filterName] = filterValue;
                        break;
                }
            }
        });

        search.search();
    };

    return (
        <FilterProvider
            filterGroups={customFilterGroups}
            filters={filters}
            setFilters={handleFilterChange}
        >
            <div className="flex gap-2 items-center">
                <FilterBtn />
                <FilterBar />
                <FilterClear />
            </div>
        </FilterProvider>
    )
}
