import { FacetBucket } from '@vertesia/common';
import { InputList } from '@vertesia/ui/core';
import { useEffect, useState } from 'react';
import type { SearchInterface } from './SearchInterface';

interface StringListFacetProps {
    search: SearchInterface;
    buckets: FacetBucket[];
    name: string;
    placeholder?: string;
    className?: string;
}
export function StringListFacet({ search, name, placeholder, className }: StringListFacetProps) {
    const [tags, setTags] = useState<string[]>([]);

    useEffect(() => {
        search.setFilterValue(name, tags);
    }, [tags]);

    return (
        <InputList className={className} value={tags} onChange={setTags} placeholder={placeholder} />
    )
}
