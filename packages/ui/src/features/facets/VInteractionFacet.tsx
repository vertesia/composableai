import { FacetBucket, InteractionStatus } from '@vertesia/common';
import { Badge, FilterGroup } from '@vertesia/ui/core';

interface EnrichedFacetBucket extends FacetBucket {
    name?: string;
    status?: string;
    version?: number;
}

interface InteractionFacetProps {
    buckets: EnrichedFacetBucket[];
    name: string;
    placeholder?: string;
}

export function VInteractionFacet({ buckets, name, placeholder }: InteractionFacetProps): FilterGroup {
    const options = buckets.map((bucket) => ({
        label: `(${bucket.count})`,
        value: bucket._id
    }));

    const filterGroup: FilterGroup = {
        name: name,
        placeholder: placeholder || `${name.charAt(0).toUpperCase() + name.slice(1)}`,
        options: options,
        type: "select",
        labelRenderer: (interactionId: string) => {
            const bucket = buckets.find(b => b._id === interactionId);
            const displayName = bucket?.name || interactionId;
            
            // Determine badge variant based on status
            let badgeVariant: "success" | "attention" | "destructive" = "success";
            if (bucket?.status) {
                switch (bucket.status) {
                    case InteractionStatus.published: 
                        badgeVariant = "success"; 
                        break;
                    case InteractionStatus.archived: 
                        badgeVariant = "destructive"; 
                        break;
                    default: 
                        badgeVariant = "attention"; 
                        break;
                }
            }
            
            const badgeText = bucket?.version && bucket?.status ? 
                `v${bucket.version} ${bucket.status}` : 
                bucket?.status || (bucket?.version ? `v${bucket.version}` : '');

            return (
                <div className="w-full flex items-center justify-between">
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm truncate">{displayName}</span>
                        {badgeText && (
                            <Badge variant={badgeVariant} className="text-xs w-fit mt-1">
                                {badgeText}
                            </Badge>
                        )}
                    </div>
                    <span className="ml-2 text-xs shrink-0">({bucket?.count || 0})</span>
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