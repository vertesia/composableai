import { facetOptionLabel } from './utils';
import { FacetBucket } from '@vertesia/common';
import { FilterGroup } from '@vertesia/ui/core';

interface StringFacetProps {
    buckets: FacetBucket[];
    name: string;
    placeholder?: string;
    type?: 'select';
    multiple?: boolean;
}

export function createStringFilterGroup({ buckets, name, placeholder, type = 'select', multiple = false }: StringFacetProps): FilterGroup {
    const options = buckets.map((bucket) => ({
        label: facetOptionLabel(bucket),
        value: bucket._id
    }));

    const filterGroup: FilterGroup = {
        name: name,
        options: options,
        type: type,
        multiple: multiple,
        placeholder: `${placeholder ?? `${name.charAt(0).toUpperCase() + name.slice(1)}`}`,
        ...({ allowCreate: false })
    };

    return filterGroup;
}

export function VStringFacet({ buckets, name, placeholder, type, multiple }: {
    search: any;
    buckets: FacetBucket[];
    name: string;
    placeholder?: string;
    className?: string;
    type?: 'select';
    multiple?: boolean;
}) {
    return createStringFilterGroup({ buckets, name, placeholder, type, multiple });
}