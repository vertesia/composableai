import { useEffect, useState } from 'react';

import { FacetBucket, FacetNameBucket } from '@vertesia/common';
import { SelectBox } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { facetOptionNameLabel } from './utils';

interface EnvironmentFacetProps {
    search: any;
    buckets: FacetBucket[];
    placeholder?: string;
    className?: string;
}
export function EnvironmentFacet({ search, buckets, placeholder = "All Environments", className }: EnvironmentFacetProps) {
    const { client } = useUserSession();

    const [options, setOptions] = useState<FacetNameBucket[]>([]);

    const filterValue = search.getFilterValue("environment") as string;
    const onChange = (option: FacetBucket | undefined) => {
        search.setFilterValue("environment", option?._id);
    }

    useEffect(() => {
        if (client) {
            const options = buckets.map(async (bucket) => {
                let name;
                await client.environments.retrieve(bucket._id).then((environment) => {
                    name = environment.name;
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
