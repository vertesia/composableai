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
                <div className="flex items-center w-full gap-2">
                    <div className="flex-1 min-w-0 flex items-center truncate">
                        <UserInfo userRef={userRef} showTitle={true} size="sm" />
                    </div>
                    <span className="text-muted-foreground flex-shrink-0">({bucket?.count || 0})</span>
                </div>
            );
        },
    };

    return filterGroup;
}

export function VUserFacet({ buckets, name, placeholder }: UserFacetProps) {
    return createUserFilterGroup({ buckets, name, placeholder });
}