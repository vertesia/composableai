import { ContentObjectTypeItem } from "@vertesia/common";

export class TypeRegistry {
    map: Record<string, ContentObjectTypeItem> = {};
    constructor(public types: ContentObjectTypeItem[]) {
        //sort types
        types.sort((a, b) => a.name.localeCompare(b.name))
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
