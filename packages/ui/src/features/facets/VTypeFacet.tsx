import { FacetBucket } from "@vertesia/common";
import { FilterGroup } from "@vertesia/ui/core";

interface VTypeFacetProps {
    buckets: FacetBucket[];
    typeRegistry: any;
}

export function VTypeFacet({ buckets, typeRegistry }: VTypeFacetProps) {
    // Create a map for quick lookups of type names and counts
    const typeDataMap = new Map();
    buckets.forEach((bucket) => {
        let name;
        let typeId = bucket._id;

        if (bucket._id == null) {
            typeId = "Document";
            name = "Document";
        } else {
            name = typeRegistry.getTypeName(bucket._id);
            if (!name) {
                console.warn("Content Object Type not found", bucket._id);
                name = bucket._id;
            }
        }

        typeDataMap.set(typeId, {
            name,
            count: bucket.count
        });
    });

    // Create options with just raw values
    const options = buckets.map((bucket) => {
        const typeId = bucket._id || "Document";
        return {
            value: typeId,
            // Store count as simple fallback label
            label: `(${bucket.count})`
        };
    });

    const customFilterGroups: FilterGroup = {
        name: 'Type',
        type: 'select',
        options: options,
        labelRenderer: (typeId: string) => {
            const typeData = typeDataMap.get(typeId);
            if (!typeData) {
                console.warn(`Type data not found for ${typeId}`);
                return typeId;
            }

            return (
                <div className="w-full flex items-center">
                    <span className="text-sm truncate">{typeData.name}</span>
                    <span className="ml-2 text-xs">({typeData.count})</span>
                </div>
            );
        },
        filterBy: (optionValue: string, searchText: string) => {
            const typeData = typeDataMap.get(optionValue);
            if (!typeData) {
                console.warn(`Type name not found for ${optionValue}`);
                return false;
            }
            return typeData.name.toLowerCase().includes(searchText.toLowerCase());
        }
    };

    return customFilterGroups;
}