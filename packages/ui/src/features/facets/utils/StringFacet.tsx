import { FacetBucket } from '@vertesia/common';
import { SelectBox } from '@vertesia/ui/core';
import { facetOptionLabel } from './utils';

interface StringFacetProps {
    search: any;
    buckets: FacetBucket[];
    name: string;
    placeholder?: string;
    className?: string;
}
export function StringFacet({ search, buckets, name, placeholder, className }: StringFacetProps) {
    const filterValue = search.getFilterValue(name) as string;
    const onChange = (option: FacetBucket | undefined) => {
        search.setFilterValue(name, option?._id);
    }

    const value = buckets?.find((option) => JSON.stringify(option._id) === JSON.stringify(filterValue));

    return (
        <SelectBox filterBy="_id" className={className} isClearable optionLabel={facetOptionLabel} options={buckets} value={value} onChange={onChange} by='_id' placeholder={placeholder} />
    )
}
