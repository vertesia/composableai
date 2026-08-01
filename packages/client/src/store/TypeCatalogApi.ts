import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { ContentObjectTypeCatalogEntry, ContentObjectTypeItem, ContentObjectTypeRef } from '@vertesia/common';

export class TypeCatalogApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/types/catalog');
    }

    /**
     * List all content types (system + app + stored)
     */
    list(
        query: { tag?: string; limit?: number; offset?: number; layout?: boolean; schema?: boolean } = {},
    ): Promise<ContentObjectTypeItem[]> {
        return this.get('/', { query });
    }

    /**
     * List system types only
     */
    listSysTypes(tag?: string): Promise<ContentObjectTypeItem[]> {
        return this.get('/sys', {
            query: { tag },
        });
    }

    /**
     * List all app types from all installed apps
     */
    listAppTypes(tag?: string): Promise<ContentObjectTypeItem[]> {
        return this.get('/apps', {
            query: { tag },
        });
    }

    /**
     * List stored types only
     */
    listStoredTypes(
        query: { tag?: string; limit?: number; offset?: number; layout?: boolean; schema?: boolean } = {},
    ): Promise<ContentObjectTypeItem[]> {
        return this.get('/stored', {
            query,
        });
    }

    /**
     * Resolve a type to its full definition.
     * Accepts a string (type ID or code) or a ContentObjectTypeRef.
     *
     * Returns a `ContentObjectTypeCatalogEntry`, which is what the endpoint publishes and is NOT
     * `ContentObjectTypeItem`: the catalog resolves in-code types contributed by plugins, which no
     * user created and no user has modified, so its four audit fields are optional. Declaring the
     * stored type here told callers `created_by` was always a string when resolving `sys:Invoice`
     * hands back a record that has none.
     *
     * @param typeOrRef Type identifier string, or a ContentObjectTypeRef from a content object
     */
    resolve(typeOrRef: string | ContentObjectTypeRef): Promise<ContentObjectTypeCatalogEntry> {
        const typeId = typeof typeOrRef === 'string' ? typeOrRef : typeOrRef.id;
        return this.get(`/resolve/${typeId}`);
    }
}
