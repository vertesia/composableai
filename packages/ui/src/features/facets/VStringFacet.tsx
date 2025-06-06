import { facetOptionLabel } from './utils';
import { FacetBucket } from '@vertesia/common';
import { FilterGroup } from '@vertesia/ui/core';

interface StringFacetProps {
    buckets: FacetBucket[];
    name: string;
}

export function createStringFilterGroup({ buckets, name }: StringFacetProps): FilterGroup {
    const options = buckets.map((bucket) => ({
        label: facetOptionLabel(bucket),
        value: bucket._id
    }));

    const filterGroup: FilterGroup = {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        options: options,
        type: "select"

    };

    return filterGroup;
}

export function VStringFacet({ buckets, name, }: {
    search: any;
    buckets: FacetBucket[];
    name: string;
    placeholder?: string;
    className?: string;
}) {
    return createStringFilterGroup({ buckets, name });
}