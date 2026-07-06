import type { ComputedFacetResponse } from '@vertesia/common';
import {
    type Filter as BaseFilter,
    FilterBar,
    FilterBtn,
    FilterClear,
    type FilterGroup,
    FilterProvider,
    useIsInModal,
} from '@vertesia/ui/core';
import { useState } from 'react';
import { useTypeRegistry } from '../store/types/TypeRegistryProvider.js';
import {
    filterValueToQueryValue,
    type SearchInterface,
    setSearchQueryValue,
    unwrapFilterOptionValue,
} from './utils/SearchInterface';
import { VStringFacet } from './utils/VStringFacet';
import { VTypeFacet } from './utils/VTypeFacet';

interface DocumentsFacetsNavProps {
    facets: ComputedFacetResponse;
    search: SearchInterface;
}

function getBuckets(value: ComputedFacetResponse[string]) {
    return Array.isArray(value) ? value : [];
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
            buckets: getBuckets(facets.type),
            typeRegistry: typeRegistry,
            type: 'select',
            multiple: true,
        });
        customFilterGroups.push(typeFilterGroup);
    }

    if (facets.status) {
        const statusFilterGroup = VStringFacet({
            buckets: getBuckets(facets.status),
            name: 'status',
            placeholder: 'Status',
            type: 'select',
            multiple: true,
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.tags) {
        customFilterGroups.push({
            name: 'tags',
            placeholder: 'Tags',
            type: 'stringList',
            options: getBuckets(facets.tags).map((tag) => ({
                label: tag._id,
                value: tag._id,
            })),
        });
    }

    customFilterGroups.push({
        name: 'created_at',
        placeholder: 'Created Date',
        type: 'date',
        multiple: true,
        options: [],
    });

    customFilterGroups.push({
        name: 'updated_at',
        placeholder: 'Updated Date',
        type: 'date',
        multiple: true,
        options: [],
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

        newFilters.forEach((filter) => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name;

                let filterValue: unknown;
                if (filter.type === 'date' && filter.multiple) {
                    // Handle date range filters
                    if (Array.isArray(filter.value) && filter.value.length > 0) {
                        if (filter.value.length === 1) {
                            // Single date - use as both start and end
                            const dateValue = unwrapFilterOptionValue(filter.value[0]);
                            filterValue = {
                                gte: dateValue,
                                lte: dateValue,
                            };
                        } else if (filter.value.length === 2) {
                            // Date range - start and end dates
                            const startDate = unwrapFilterOptionValue(filter.value[0]);
                            const endDate = unwrapFilterOptionValue(filter.value[1]);
                            filterValue = {
                                gte: startDate,
                                lte: endDate,
                            };
                        }
                    }
                } else {
                    filterValue = filterValueToQueryValue(filter);
                }

                if (filterName === 'name') {
                    setSearchQueryValue(search, 'name', filterValue);
                } else if (filterName === 'id') {
                    setSearchQueryValue(search, 'id', filterValue);
                } else {
                    setSearchQueryValue(search, filterName, filterValue);
                }
            }
        });

        void search.search();
    };
}

// Legacy component for backward compatibility
export function DocumentsFacetsNav({ facets, search }: DocumentsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const filterGroups = useDocumentFilterGroups(facets);
    const handleFilterLogic = useDocumentFilterHandler(search);
    const inModal = useIsInModal();

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        const newFilters = typeof value === 'function' ? value(filters) : value;
        setFilters(newFilters);
        handleFilterLogic(newFilters);
    };

    return (
        <FilterProvider filterGroups={filterGroups} filters={filters} setFilters={handleFilterChange} inModal={inModal}>
            <div className="flex gap-2 items-center">
                <FilterBtn />
                <FilterBar />
                <FilterClear />
            </div>
        </FilterProvider>
    );
}
