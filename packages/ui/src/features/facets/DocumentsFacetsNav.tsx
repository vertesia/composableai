import { Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';
import { useTypeRegistry } from '../store/types/TypeRegistryProvider.js';
import { VStringFacet } from './utils/VStringFacet';
import { VTypeFacet } from './utils/VTypeFacet';
import { SearchInterface } from './utils/SearchInterface';

interface DocumentsFacetsNavProps {
    facets: {
        type?: any[];
        status?: any[];
        role?: any[];
        location?: any[];
        tags?: string[];
    };
    search: SearchInterface;
}

// Hook to create filter groups for documents
export function useDocumentFilterGroups(facets: DocumentsFacetsNavProps['facets']): FilterGroup[] {
    const { registry: typeRegistry } = useTypeRegistry();
    const customFilterGroups: FilterGroup[] = [];

    customFilterGroups.push({
        placeholder: 'ID',
        name: 'id',
        type: 'text',
        options: [],
    });

    customFilterGroups.push({
        placeholder: 'Name',
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
            search: null as any, // This will be provided by the search context
            buckets: facets.status || [],
            name: 'status',
            placeholder: 'Status',
            type: 'select',
            multiple: true
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.tags) {
        customFilterGroups.push({
            name: 'tags',
            placeholder: 'Tags',
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

    return customFilterGroups;
}

// Hook to create filter change handler for documents
export function useDocumentFilterHandler(search: SearchInterface) {
    return (newFilters: BaseFilter[]) => {
        if (newFilters.length === 0) {
            search.clearFilters();
            return;
        }

        search.clearFilters(false);

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;

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
                    if (Array.isArray(filter.value)) {
                        filterValue = filter.value.map((v: any) => typeof v === 'object' && v.value ? v.value : v);
                    } else {
                        const singleValue = typeof filter.value === 'object' && (filter.value as any).value ? (filter.value as any).value : filter.value;
                        filterValue = [singleValue];
                    }
                } else {
                    // Single value - don't wrap in array
                    filterValue = Array.isArray(filter.value) && filter.value[0] && typeof filter.value[0] === 'object'
                        ? (filter.value[0] as any).value
                        : Array.isArray(filter.value) && filter.value[0]
                            ? filter.value[0]
                            : filter.value;
                }

                if (filterName === 'name') {
                    search.query.name = filterValue;
                } else if (filterName === 'id') {
                    search.query.id = filterValue;
                } else {
                    search.query[filterName] = filterValue;
                }
            }
        });

        search.search();
    };
}

// Legacy component for backward compatibility
export function DocumentsFacetsNav({
    facets,
    search,
}: DocumentsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const filterGroups = useDocumentFilterGroups(facets);
    const handleFilterLogic = useDocumentFilterHandler(search);

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
