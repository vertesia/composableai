import type { ContentObjectTypeCatalogEntry } from '@vertesia/common';

/**
 * Holds the type catalog, which is `ContentObjectTypeCatalogEntry` rather than
 * `ContentObjectTypeItem`: the listing includes system and app types, which are declared in code and
 * therefore carry none of the four audit fields.
 */
export class TypeRegistry {
    map: Record<string, ContentObjectTypeCatalogEntry> = {};
    constructor(public types: ContentObjectTypeCatalogEntry[]) {
        //sort types
        types.sort((a, b) => a.name.localeCompare(b.name));
        for (const type of types) {
            this.map[type.id] = type;
        }
    }

    getType(id: string) {
        return this.map[id];
    }

    getTypeLayout(id: string) {
        const type = this.map[id];
        return type ? type.table_layout : undefined;
    }

    getTypeName(id: string) {
        const type = this.map[id];
        return type ? type.name : undefined;
    }
}
