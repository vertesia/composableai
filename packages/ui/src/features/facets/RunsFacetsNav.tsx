import { Button, type Filter as BaseFilter, FilterProvider, FilterBtn, FilterBar, FilterClear, type FilterGroup } from '@vertesia/ui/core';
import { useState } from 'react';
import { VEnvironmentFacet } from './utils/VEnvironmentFacet';
import { VInteractionFacet } from './utils/VInteractionFacet';
import type { EnrichedFacetBucket } from './utils/VInteractionFacet';
import { VStringFacet } from './utils/VStringFacet';
import { VUserFacet } from './utils/VUserFacet';
import { filterValueToQueryValue, type SearchInterface, setSearchQueryValue } from './utils/SearchInterface';
import { RefreshCw } from 'lucide-react';
import type { FacetBucket } from '@vertesia/common';

interface RunsFacetsNavProps {
    facets: {
        type?: FacetBucket[];
        interactions?: EnrichedFacetBucket[];
        environments?: FacetBucket[];
        models?: FacetBucket[];
        statuses?: FacetBucket[];
        tags?: FacetBucket[];
        finish_reason?: FacetBucket[];
        created_by?: FacetBucket[];
    };
    search: SearchInterface;
    actions?: React.ReactNode[];
    selectionCount?: number;
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
            buckets: facets.models || [],
            name: 'model'
        });
        customFilterGroups.push(modelFilterGroup);
    }

    if (facets.statuses) {
        const statusFilterGroup = VStringFacet({
            buckets: facets.statuses || [],
            name: 'status'
        });
        customFilterGroups.push(statusFilterGroup);
    }

    if (facets.finish_reason) {
        const processedFinishReason = facets.finish_reason.map((bucket) => ({
            ...bucket,
            _id: bucket._id === null ? 'none' : bucket._id
        }));

        const finishReasonFilterGroup = VStringFacet({
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

    const workflowIdFilterGroup = {
        name: 'workflow_ids',
        placeholder: 'Workflow ID',
        type: 'text' as const,
        multiple: false
    };
    customFilterGroups.push(workflowIdFilterGroup);

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
                let filterValue = filterValueToQueryValue(filter);

                // Force array format for backend fields that expect arrays
                if ((filterName === 'run_ids' || filterName === 'workflow_run_ids' || filterName === 'workflow_ids') && !Array.isArray(filterValue)) {
                    filterValue = [filterValue];
                }

                setSearchQueryValue(search, filterName, filterValue);
            }
        });

        search.search();
    };
}

// Legacy component for backward compatibility
export function RunsFacetsNav({ facets, search, actions, selectionCount }: RunsFacetsNavProps) {
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
            <div className='gap-2 items-center w-full'>
                <div className='flex justify-between mb-1'>
                    <FilterBtn />
                    <div className='flex justify-end'>
                        {!selectionCount && (
                            <div className="flex items-center justify-between px-2 py-1">
                                <div className="text-sm text-muted">
                                    {search.initialized ? `${search.totalCount} calls` : 'Loading calls...'}
                                </div>
                            </div>
                        )}
                        {actions && actions.length > 0 ? (
                            <div className='flex items-center gap-2 mb-1 me-2'>
                                {actions.map((action, index) => (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: list order is stable for this render
                                    <div key={index}>{action}</div>
                                ))}
                            </div>
                        ) : null}
                        <Button onClick={handleRefetch} variant='outline' title="Refresh">
                            <RefreshCw className="size-5" />
                        </Button>
                    </div>
                </div>
                {filters.length > 0 && (
                    <div className='flex items-center gap-2 mb-1'>
                        <FilterBar />
                        <FilterClear />
                    </div>
                )}

            </div>
        </FilterProvider>
    );
}
