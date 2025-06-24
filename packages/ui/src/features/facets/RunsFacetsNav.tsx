import { Filter as BaseFilter, FilterBar, FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';
import { VEnvironmentFacet } from './VEnvironmentFacet';
import { VInteractionFacet } from './VInteractionFacet';
import { VStringFacet } from './VStringFacet';
import { VUserFacet } from './VUserFacet';
import { SearchInterface } from './VFacetsNav';

interface RunsFacetsNavProps {
    facets: {
        type?: any[];
        interactions?: any[];
        environments?: any[];
        models?: any[];
        statuses?: any[];
        finish_reason?: any[];
        created_by?: any[];
    };
    search: SearchInterface;
}

export function RunsFacetsNav({ facets, search }: RunsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const customFilterGroups: FilterGroup[] = [];

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

                search.query[filterName] = filterValue;
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