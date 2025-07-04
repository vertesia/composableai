import { Filter as BaseFilter, FilterBar, FilterGroup } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { useState } from 'react';
import { VEnvironmentFacet } from './VEnvironmentFacet';
import { VInteractionFacet } from './VInteractionFacet';
import { VStringFacet } from './VStringFacet';
import { VTypeFacet } from './VTypeFacet';
import { VUserFacet } from './VUserFacet';

export interface SearchInterface {
    getFilterValue(name: string): any;
    setFilterValue(name: string, value: any): void;
    clearFilters(autoSearch?: boolean): void;
    search(): Promise<boolean | undefined>;
    readonly isRunning: boolean;
    query: Record<string, any>;
}

interface FacetsNavProps {
    facets: any;
    search: SearchInterface;
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

    /** Run table */
    if (facets.interactions) {
        const interactionFilterGroup = VInteractionFacet({
            buckets: facets.interactions || [],
            name: 'interaction',
            placeholder: 'Interactions',
        });
        customFilterGroups.push(interactionFilterGroup);
    }

    if (facets.environments) {
        const environmentFilterGroup = VEnvironmentFacet({
            buckets: facets.environments || [],
            name: 'Environments'
        });
        customFilterGroups.push(environmentFilterGroup);
    }

    if (facets.models) {
        const modelFilterGroup = VStringFacet({
            search,
            buckets: facets.models || [],
            name: 'Model'
        });
        customFilterGroups.push(modelFilterGroup);
    }

    if (facets.statuses) {
        const statusFilterGroup = VStringFacet({
            search,
            buckets: facets.statuses || [],
            name: 'Status'
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.finish_reason) {
        const processedFinishReason = facets.finish_reason.map((bucket: any) => ({
            ...bucket,
            _id: bucket._id === null ? 'none' : bucket._id
        }));

        const finishReasonFilterGroup = VStringFacet({
            search,
            buckets: processedFinishReason,
            name: 'finish_reason',
            placeholder: 'Finish Reason'
        });
        customFilterGroups.push(finishReasonFilterGroup);
    }

    if (facets.created_by) {
        const createdByFilterGroup = VUserFacet({
            buckets: facets.created_by || [],
            name: 'created_by',
            placeholder: 'Created By'
        });
        customFilterGroups.push(createdByFilterGroup);
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
    /** Run table */

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
        <FilterBar
            filterGroups={customFilterGroups}
            filters={filters}
            setFilters={handleFilterChange}
        />
    )
}
