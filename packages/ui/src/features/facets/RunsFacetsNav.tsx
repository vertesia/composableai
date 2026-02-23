import { Button, Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';
import { VEnvironmentFacet } from './utils/VEnvironmentFacet';
import { VInteractionFacet } from './utils/VInteractionFacet';
import { VStringFacet } from './utils/VStringFacet';
import { VUserFacet } from './utils/VUserFacet';
import { SearchInterface } from './utils/SearchInterface';
import { RefreshCw } from 'lucide-react';

interface RunsFacetsNavProps {
    facets: {
        type?: any[];
        interactions?: any[];
        environments?: any[];
        models?: any[];
        statuses?: any[];
        tags?: any[];
        finish_reason?: any[];
        created_by?: any[];
    };
    search: SearchInterface;
}

// Hook to create filter groups for runs
export function useRunsFilterGroups(facets: RunsFacetsNavProps['facets']): FilterGroup[] {
    const customFilterGroups: FilterGroup[] = [];

    const runIdFilterGroup = {
        name: 'run_ids',
        placeholder: 'Run ID',
        type: 'text' as const,
        multiple: false
    };
    customFilterGroups.push(runIdFilterGroup);

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
            name: 'environments',
        });
        customFilterGroups.push(environmentFilterGroup);
    }

    // Add tags filter as stringList type (allows custom input)
    const tagsFilterGroup = {
        name: 'tags',
        placeholder: 'Tags',
        type: 'stringList' as const,
        multiple: true
    };
    customFilterGroups.push(tagsFilterGroup);

    if (facets.models) {
        const modelFilterGroup = VStringFacet({
            search: null as any, // This will be provided by the search context
            buckets: facets.models || [],
            name: 'model'
        });
        customFilterGroups.push(modelFilterGroup);
    }

    if (facets.statuses) {
        const statusFilterGroup = VStringFacet({
            search: null as any, // This will be provided by the search context
            buckets: facets.statuses || [],
            name: 'status'
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.finish_reason) {
        const processedFinishReason = facets.finish_reason.map((bucket: any) => ({
            ...bucket,
            _id: bucket._id === null ? 'none' : bucket._id
        }));

        const finishReasonFilterGroup = VStringFacet({
            search: null as any, // This will be provided by the search context
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

    const dateAfterFilterGroup = {
        name: 'start',
        placeholder: 'Date After',
        type: 'date' as const,
        multiple: false
    };
    customFilterGroups.push(dateAfterFilterGroup);

    const dateBeforeFilterGroup = {
        name: 'end',
        placeholder: 'Date Before',
        type: 'date' as const,
        multiple: false
    };
    customFilterGroups.push(dateBeforeFilterGroup);

    const workflowRunIdFilterGroup = {
        name: 'workflow_run_ids',
        placeholder: 'Workflow Run ID',
        type: 'text' as const,
        multiple: false
    };
    customFilterGroups.push(workflowRunIdFilterGroup);

    return customFilterGroups;
}

// Hook to create filter change handler for runs
export function useRunsFilterHandler(search: SearchInterface) {
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

                // Force array format for backend fields that expect arrays
                if ((filterName === 'run_ids' || filterName === 'workflow_run_ids') && !Array.isArray(filterValue)) {
                    filterValue = [filterValue];
                }

                search.query[filterName] = filterValue;
            }
        });

        search.search();
    };
}

// Legacy component for backward compatibility
export function RunsFacetsNav({ facets, search }: RunsFacetsNavProps) {
    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const filterGroups = useRunsFilterGroups(facets);
    const handleFilterLogic = useRunsFilterHandler(search);

    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        const newFilters = typeof value === 'function' ? value(filters) : value;
        setFilters(newFilters);
        handleFilterLogic(newFilters);
    };

    const handleRefetch = () => {
        search.search();
    }

    return (
        <FilterProvider
            filterGroups={filterGroups}
            filters={filters}
            setFilters={handleFilterChange}
        >
            <div className='flex justify-between mb-1 sticky top-0 py-2 z-10 bg-background'>
                <div className='flex gap-2 items-center'>
                    <FilterBtn />
                    <FilterBar />
                    <FilterClear />
                </div>
                <Button onClick={handleRefetch} variant='outline' title="Refresh">
                    <RefreshCw className="size-5" />
                </Button>
            </div>
        </FilterProvider>
    );
}