import { FacetBucket } from "@vertesia/common";
import { SelectBox } from "@vertesia/ui/core";
import { useEffect, useState } from "react";
import { UserInfo } from '../user/UserInfo';

export function facetOptionLabel(bucket: FacetBucket) {
    if (bucket._id == null) {
        return `UnKnown User (${bucket.count})`;
    }
    else {
        return (
            <UserInfo userRef={bucket._id} showTitle={true} size={"sm"} />
        );
    }
}

interface UserFacetProps {
    search: any;
    buckets: FacetBucket[];
    placeholder?: string;
    className?: string;
    name: string;
}

export function UserFacet({ search, buckets, placeholder = "Filter by User", className }: UserFacetProps) {
    const [options, setOptions] = useState<FacetBucket[]>([]);
    const filterValue = search.getFilterValue("created_by") as string;

    const onChange = (option: FacetBucket | undefined) => {
        search.setFilterValue("created_by", option?._id);
    }

    useEffect(() => {
        const fetchOptions = async () => {
            const options = await Promise.all(buckets.map(async (bucket) => {
                return {
                    ...bucket,
                }
            }));
            setOptions(options);
        };
        fetchOptions();
    }, [buckets]);


    const value = options?.find((option) => option._id === filterValue);

    return (
        <SelectBox
            filterBy="name"
            className={className}
            isClearable
            optionLabel={facetOptionLabel}
            options={options}
            value={value}
            onChange={onChange}
            by='_id'
            placeholder={placeholder}
        />
    )
}
