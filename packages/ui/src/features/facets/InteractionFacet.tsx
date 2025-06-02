import { useEffect, useState } from 'react';

import { FacetBucket, FacetNameBucket } from '@vertesia/common';
import { SelectBox } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { facetOptionNameLabel } from './utils';

interface InteractionFacetProps {
    search: any;
    buckets: FacetBucket[];
    placeholder?: string;
    className?: string;
}
export function InteractionFacet({ search, buckets, placeholder = "All Interactions", className }: InteractionFacetProps) {
    const { client } = useUserSession();

    const [options, setOptions] = useState<FacetNameBucket[]>([]);

    const filterValue = search.getFilterValue("interaction") as string;
    const onChange = (option: FacetBucket | undefined) => {
        search.setFilterValue("interaction", option?._id);
    }

    useEffect(() => {
        if (client) {
            const options = buckets.map(async (bucket) => {
                let name;
                await client.interactions.retrieve(bucket._id).then((interaction) => {
                    name = interaction.name;
                }).catch(() => {
                    name = `${bucket._id} (deleted)`;
                });
                if (!name) {
                    name = bucket._id;
                }
                return {
                    ...bucket,
                    name
                }
            })
            Promise.all(options).then(resolvedOptions => {
                resolvedOptions.sort((a, b) => a.name.localeCompare(b.name));
                setOptions(resolvedOptions);
            });
        }
    }, [buckets, client]);

    const value = options?.find((option) => option._id === filterValue);

    return (
        <SelectBox filterBy="name" className={className} isClearable optionLabel={facetOptionNameLabel} options={options} value={value} onChange={onChange} by='_id' placeholder={placeholder} />
    )
}
