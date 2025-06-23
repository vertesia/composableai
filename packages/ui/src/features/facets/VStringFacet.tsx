import { facetOptionLabel } from './utils';
import { FacetBucket } from '@vertesia/common';
import { FilterGroup } from '@vertesia/ui/core';

interface StringFacetProps {
    buckets: FacetBucket[];
    name: string;
    placeholder?: string;
}

export function createStringFilterGroup({ buckets, name, placeholder }: StringFacetProps): FilterGroup {
    const options = buckets.map((bucket) => ({
        label: facetOptionLabel(bucket),
        value: bucket._id
    }));

    const filterGroup: FilterGroup = {
        name: name,
        options: options,
        type: "select",
        placeholder: `${placeholder ?? `${name.charAt(0).toUpperCase() + name.slice(1)}`}`,
    };

    return filterGroup;
}

export function VStringFacet({ buckets, name, placeholder}: {
    search: any;
    buckets: FacetBucket[];
    name: string;
    placeholder?: string;
    className?: string;
}) {
    return createStringFilterGroup({ buckets, name, placeholder });
}