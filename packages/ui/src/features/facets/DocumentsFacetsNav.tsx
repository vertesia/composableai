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

    if (textSearch) {
        customFilterGroups.push({
            placeholder: textSearch,
            name: 'name',
            type: 'text',
            options: [],
        });
    }

    if (facets.type) {
        const typeFilterGroup = VTypeFacet({
            buckets: facets.type || [],
            typeRegistry: typeRegistry,
        });
        customFilterGroups.push(typeFilterGroup);
    }

    if (facets.status) {
        const statusFilterGroup = VStringFacet({
            search,
            buckets: facets.status || [],
            name: 'Status'
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.role) {
        const roleFilterGroup = VStringFacet({
            search,
            buckets: facets.role || [],
            name: 'Role'
        });
        customFilterGroups.push(roleFilterGroup);
    }

    if (facets.location) {
        const locationFilterGroup = VStringFacet({
            search,
            buckets: facets.location || [],
            name: 'Location'
        });
        customFilterGroups.push(locationFilterGroup);
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
                const filterValue = filter.type === 'stringList' 
                    ? filter.value.map(v => typeof v === 'string' ? v : v.value) 
                    : Array.isArray(filter.value) && filter.value[0] && typeof filter.value[0] === 'object' 
                        ? filter.value[0].value 
                        : filter.value;

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