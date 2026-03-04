import { FacetBucket } from "@vertesia/common";
import { FilterGroup } from "@vertesia/ui/core";
import { TypeRegistry } from "../../store/types/TypeRegistry.js";

interface VTypeFacetProps {
    buckets: FacetBucket[];
    typeRegistry?: TypeRegistry;
    type?: 'select';
    multiple?: boolean;
}

export function VTypeFacet({ buckets, typeRegistry, type = 'select', multiple = false }: VTypeFacetProps) {
    // Create a map for quick lookups of type names and counts
    const typeDataMap = new Map();
    if (!typeRegistry) {
        console.warn("Type names cannot be resolved");
    }
    buckets.forEach((bucket) => {
        let name;
        let typeId = bucket._id;

        if (bucket._id == null) {
            typeId = "Document";
            name = "Document";
        } else {
            name = typeRegistry?.getTypeName(bucket._id);
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

    const options = buckets.map((bucket) => {
        const actualId = bucket._id;
        const displayKey = actualId || "Document";
        const typeData = typeDataMap.get(displayKey);
        
        return {
            value: actualId,
            label: typeData ? `${typeData.name} (${typeData.count})` : `Unknown (${bucket.count})`
        };
    });

    const customFilterGroups: FilterGroup = {
        name: 'types',
        placeholder: 'Types',
        type: type,
        multiple: multiple,
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