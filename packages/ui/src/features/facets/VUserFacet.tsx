import { FacetBucket } from '@vertesia/common';
import { FilterGroup } from '@vertesia/ui/core';
import { UserInfo } from '../user/UserInfo';

interface UserFacetProps {
    buckets: FacetBucket[];
    name: string;
    placeholder?: string;
}

export function createUserFilterGroup({ buckets, name, placeholder }: UserFacetProps): FilterGroup {
    const options = buckets.map((bucket) => {
        return {
            value: bucket._id,
            label: `(${bucket.count})`
        };
    });

    const filterGroup: FilterGroup = {
        name: name,
        placeholder: placeholder || `${name.charAt(0).toUpperCase() + name.slice(1)}`,
        options: options,
        labelRenderer: (userRef: string) => {
            const isUnknownUser = userRef === 'Unknown User' || !userRef;

            if (isUnknownUser) {
                // Find the count for this user from buckets
                const bucket = buckets.find(b => b._id === userRef);
                return `Unknown User (${bucket?.count || 0})`;
            }

            // For known users, render UserInfo with count
            const bucket = buckets.find(b => b._id === userRef);
            return (
                <div className="flex items-center justify-between w-full">
                    <UserInfo userRef={userRef} showTitle={true} size="sm" />
                    <span className="text-muted-foreground ml-2">({bucket?.count || 0})</span>
                </div>
            );
        },
    };

    return filterGroup;
}

export function VUserFacet({ buckets, name, placeholder }: UserFacetProps) {
    return createUserFilterGroup({ buckets, name, placeholder });
}