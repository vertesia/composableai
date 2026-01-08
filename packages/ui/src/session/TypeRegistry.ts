import { ContentObjectTypeItem } from "@vertesia/common";

export class TypeRegistry {
    map: Record<string, ContentObjectTypeItem> = {};
    private loadedAt: number;
    private ttlMs: number = 60 * 1000; // 60 seconds TTL

    constructor(public types: ContentObjectTypeItem[]) {
        //sort types
        types.sort((a, b) => a.name.localeCompare(b.name))
        for (const type of types) {
            this.map[type.id] = type;
        }
        this.loadedAt = Date.now();
    }

    /**
     * Check if the cache is stale based on TTL
     */
    isStale(): boolean {
        return Date.now() - this.loadedAt > this.ttlMs;
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
