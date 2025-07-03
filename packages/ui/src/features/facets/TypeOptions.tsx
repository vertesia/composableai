import { useUserSession } from "@vertesia/ui/session";
import { FacetBucket } from "@vertesia/common";
import { FilterOption } from "@vertesia/ui/core";

export function TypeOptionLabel(buckets: FacetBucket[]): FilterOption[] {
    const { typeRegistry } = useUserSession();

    return buckets.map((bucket) => {
        let name;
        if (bucket._id == null) {
            bucket._id = "Document";
            name = "Document";
        } else {
            name = typeRegistry?.getTypeName(bucket._id) || bucket._id;
        }

        return {
            name: `${name} (${bucket.count})`,
            value: bucket._id,
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
}