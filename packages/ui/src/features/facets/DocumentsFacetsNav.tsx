import { Filter as BaseFilter, FilterBar, FilterGroup } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { useState } from 'react';
import { VStringFacet } from './VStringFacet';
import { VTypeFacet } from './VTypeFacet';
import { SearchInterface } from './VFacetsNav';

interface DocumentsFacetsNavProps {
    facets: {
        type?: any[];
        status?: any[];
        role?: any[];
        location?: any[];
        tags?: string[];
    };
    search: SearchInterface;
    textSearch?: string;
}

export function DocumentsFacetsNav({
    facets,
    search,
    textSearch = 'Filter content'
}: DocumentsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const customFilterGroups: FilterGroup[] = [];
    const { typeRegistry } = useUserSession();

    customFilterGroups.push({
        placeholder: textSearch,
        name: 'name',
        type: 'text',
        options: [],
    });

    if (facets.type) {
        const typeFilterGroup = VTypeFacet({
            buckets: facets.type || [],
            typeRegistry: typeRegistry,
            type: 'select',
            multiple: true
        });
        customFilterGroups.push(typeFilterGroup);
    }

    if (facets.status) {
        const statusFilterGroup = VStringFacet({
            search,
            buckets: facets.status || [],
            name: 'Status',
            type: 'select',
            multiple: true
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.tags) {
        customFilterGroups.push({
            name: 'Tags',
            type: 'stringList',
            options: facets.tags.map((tag: string) => ({
                label: tag,
                value: tag
            }))
        });
    }

    customFilterGroups.push({
        name: 'created_at',
        placeholder: 'Created Date',
        type: 'date',
        multiple: true,
        options: []
    });

    customFilterGroups.push({
        name: 'updated_at',
        placeholder: 'Updated Date',
        type: 'date',
        multiple: true,
        options: []
    });

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        const newFilters = typeof value === 'function' ? value(filters) : value;
        if (newFilters.length === 0) {
            search.clearFilters();
            setFilters([]);
            return;
        }
        setFilters(newFilters);

        search.clearFilters(false);

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name.toLowerCase();
                
                let filterValue;
                if (filter.type === 'date' && filter.multiple) {
                    // Handle date range filters
                    if (Array.isArray(filter.value) && filter.value.length > 0) {
                        if (filter.value.length === 1) {
                            // Single date - use as both start and end
                            const dateValue = typeof filter.value[0] === 'object' ? (filter.value[0] as any).value : filter.value[0];
                            filterValue = {
                                gte: dateValue,
                                lte: dateValue
                            };
                        } else if (filter.value.length === 2) {
                            // Date range - start and end dates
                            const startDate = typeof filter.value[0] === 'object' ? (filter.value[0] as any).value : filter.value[0];
                            const endDate = typeof filter.value[1] === 'object' ? (filter.value[1] as any).value : filter.value[1];
                            filterValue = {
                                gte: startDate,
                                lte: endDate
                            };
                        }
                    }
                } else if (filter.multiple) {
                    filterValue = Array.isArray(filter.value) 
                        ? filter.value.map((v: any) => typeof v === 'object' && v.value ? v.value : v)
                        : [typeof filter.value === 'object' && (filter.value as any).value ? (filter.value as any).value : filter.value];
                } else {
                    filterValue = Array.isArray(filter.value) && filter.value[0] && typeof filter.value[0] === 'object'
                        ? (filter.value[0] as any).value
                        : filter.value;
                }
                
                if (filterName === 'name') {
                    search.query.search_term = filterValue;
                    search.query.name = filterValue;
                } else {
                    search.query[filterName] = filterValue;
                }
            }
        });

        search.search();
    };

    return (
        <FilterBar
            filterGroups={customFilterGroups}
            filters={filters}
            setFilters={handleFilterChange}
        />
    );
}
