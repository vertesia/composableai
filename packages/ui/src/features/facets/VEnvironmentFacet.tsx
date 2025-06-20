import { FacetBucket } from '@vertesia/common';
import { FilterGroup } from '@vertesia/ui/core';

interface EnrichedFacetBucket extends FacetBucket {
    name?: string;
}

interface EnvironmentFacetProps {
    buckets: EnrichedFacetBucket[];
    name: string;
}

export function VEnvironmentFacet({ buckets, name }: EnvironmentFacetProps): FilterGroup {
    const options = buckets.map((bucket) => ({
        label: `(${bucket.count})`,
        value: bucket._id
    }));

    const filterGroup: FilterGroup = {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        options: options,
        type: "select",
        labelRenderer: (environmentId: string) => {
            const bucket = buckets.find(b => b._id === environmentId);
            const displayName = bucket?.name || environmentId;

            return (
                <div className="w-full flex items-center">
                    <span className="text-sm truncate">{displayName}</span>
                    <span className="ml-2 text-xs">({bucket?.count || 0})</span>
                </div>
            );
        },
        filterBy: (optionValue: string, searchText: string) => {
            const bucket = buckets.find(b => b._id === optionValue);
            const searchName = bucket?.name || optionValue;
            return searchName.toLowerCase().includes(searchText.toLowerCase());
        }
    };

    return filterGroup;
}