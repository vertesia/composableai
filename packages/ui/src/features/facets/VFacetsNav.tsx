import { Filter as BaseFilter, FilterBar, FilterGroup } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { useState } from 'react';
import { VStringFacet } from './VStringFacet';
import { VTypeFacet } from './VTypeFacet';
import { VUserFacet } from './VUserFacet';

interface FacetsNavProps {
    facets: any;
    search: any;
    textSearch?: string;
}
export function VFacetsNav({ facets, search, textSearch = '' }: FacetsNavProps) {
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

    if (facets.initiated_by) {
        const initiatedByFilterGroup = VUserFacet({
            buckets: facets.initiated_by || [],
            name: 'User'
        });
        customFilterGroups.push(initiatedByFilterGroup);
    }

    if (facets.start) {
        customFilterGroups.push({
            name: 'start',
            placeholder: 'Date after',
            type: 'date' as const,
            options: []
        });
    }

    if (facets.end) {
        customFilterGroups.push({
            name: 'end',
            placeholder: 'Date before',
            type: 'date' as const,
            options: []
        });
    }

    // if (facets.tags) {
    //     customFilterGroups.push({
    //         name: 'Tags',
    //         type: 'text',
    //         options: facets.tags.map((tag: string) => ({
    //             label: tag,
    //             value: tag
    //         }))
    //     });
    // }

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {

        const newFilters = typeof value === 'function' ? value(filters) : value;
        if (newFilters.length === 0) {
            search.clearFilters();
            setFilters([]);
            return;
        }
        setFilters(newFilters);

        newFilters.forEach(filter => {
            if (filter.value && filter.value.length > 0) {
                const filterName = filter.name.toLowerCase();
                const filterValue = filter.value[0].value;

                // Map filter names to the expected field names
                switch (filterName) {
                    case 'name':
                        search.query.search_term = filterValue;
                        search.query.name = filterValue;
                        break;
                    case 'user':
                        search.query.initiated_by = filterValue === 'Unknown User' ? 'unknown' : filterValue;
                        break;
                    default:
                        (search.query as any)[filterName] = filterValue;
                        break;
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
    )
}
