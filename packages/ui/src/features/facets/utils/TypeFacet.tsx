import { FacetBucket } from "@vertesia/common";
import { SelectBox } from "@vertesia/ui/core";
import { useEffect, useState } from "react";
import { useTypeRegistry } from "../../store/types/TypeRegistryProvider.js";

interface TypeFacetBucket {
    name: string;
    _id: string;
    count: number;
}

export function facetOptionLabel(bucket: TypeFacetBucket) {
    return `${bucket.name} (${bucket.count})`;
}

interface TypeFacetProps {
    search: any;
    buckets: FacetBucket[];
    placeholder?: string;
    className?: string;
}
export function TypeFacet({ search, buckets, placeholder = "Filter by Type", className }: TypeFacetProps) {
    const [options, setOptions] = useState<TypeFacetBucket[]>([]);
    const { registry: typeRegistry } = useTypeRegistry();
    const filterValue = search.getFilterValue("type") as string;
    const onChange = (option: FacetBucket | undefined) => {
        search.setFilterValue("type", option?._id);
    }

    useEffect(() => {
        if (typeRegistry) {
            const options = buckets.map((bucket) => {
                let name;
                if (bucket._id == null) {
                    bucket._id = "Document";
                    name = "Document"
                } else {
                    name = typeRegistry.getTypeName(bucket._id);
                    if (!name) {
                        console.warn("Content Object Type not found", bucket._id)
                        name = bucket._id
                    }
                }
                return {
                    ...bucket,
                    name
                }
            })
            options.sort((a, b) => a.name.localeCompare(b.name));
            setOptions(options);
        }
    }, [buckets, typeRegistry]);

    const value = options?.find((option) => option._id === filterValue);

    return (
        <SelectBox filterBy="name" className={className} isClearable optionLabel={facetOptionLabel} options={options} value={value} onChange={onChange} by='_id' placeholder={placeholder} />
    )
}
