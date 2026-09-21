import type { FacetBucket } from '@vertesia/common';
import { Badge, type FilterGroup } from '@vertesia/ui/core';
import {
    type InteractionDisplayRef,
    InteractionStatusBadge,
    resolveInteractionName,
    splitInteractionType,
} from '../../utils/interaction.js';

export interface EnrichedFacetBucket extends FacetBucket, InteractionDisplayRef {}

interface InteractionFacetProps {
    buckets: EnrichedFacetBucket[];
    name: string;
    placeholder?: string;
}

/** The name this facet displays for a bucket — the same one the runs table shows for the run. */
function bucketName(bucket: EnrichedFacetBucket | undefined, interactionId: string): string {
    return resolveInteractionName(bucket, interactionId) ?? interactionId;
}

export function VInteractionFacet({ buckets, name, placeholder }: InteractionFacetProps): FilterGroup {
    const options = buckets.map((bucket) => ({
        label: `(${bucket.count})`,
        value: bucket._id,
    }));

    const filterGroup: FilterGroup = {
        name: name,
        placeholder: placeholder || `${name.charAt(0).toUpperCase() + name.slice(1)}`,
        options: options,
        type: 'select',
        labelRenderer: (interactionId: string) => {
            const bucket = buckets.find((b) => b._id === interactionId);
            // Same split as the runs table: the `sys`/`app`/`tmp` namespace becomes its own badge
            // instead of staying glued to the name.
            const { type, label } = splitInteractionType(bucketName(bucket, interactionId));

            return (
                <div className="w-full flex items-center justify-between">
                    <div className="flex flex-row flex-wrap items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm truncate">{label}</span>
                        {type && (
                            <Badge variant="secondary" className="text-xs w-fit">
                                {type}
                            </Badge>
                        )}
                        {bucket && <InteractionStatusBadge interaction={bucket} className="text-xs w-fit" />}
                    </div>
                    {(bucket?.count ?? 0) > 0 && <span className="ms-2 text-xs shrink-0">({bucket?.count})</span>}
                </div>
            );
        },
        filterBy: (optionValue: string, searchText: string) => {
            const bucket = buckets.find((b) => b._id === optionValue);
            return bucketName(bucket, optionValue).toLowerCase().includes(searchText.toLowerCase());
        },
    };

    return filterGroup;
}
