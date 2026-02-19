import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import { ContentObjectTypeItem, ContentObjectTypeRef, InCodeTypeDefinition } from '@vertesia/common';


export class TypeCatalogApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/types/catalog');
    }

    /**
     * List all content types (system + app + stored)
     */
    list(query: { tag?: string, layout?: boolean, schema?: boolean } = {}): Promise<ContentObjectTypeItem[]> {
        return this.get('/', { query });
    }

    /**
     * List system types only
     */
    listSysTypes(tag?: string): Promise<ContentObjectTypeItem[]> {
        return this.get('/sys', {
            query: { tag }
        });
    }

    /**
     * List all app types from all installed apps
     */
    listAllAppTypes(tag?: string): Promise<ContentObjectTypeItem[]> {
        return this.get('/apps', {
            query: { tag }
        });
    }

    /**
     * List types from a specific app
     */
    listAppTypes(appName: string, tag?: string): Promise<ContentObjectTypeItem[]> {
        return this.get(`/apps/${appName}`, {
            query: { tag }
        });
    }

    /**
     * List stored types only
     */
    listStoredTypes(query: { tag?: string, layout?: boolean, schema?: boolean } = {}): Promise<ContentObjectTypeItem[]> {
        return this.get('/stored', {
            query
        });
    }

    /**
     * Resolve a type to its full definition.
     * Accepts a string (type ID or code) or a ContentObjectTypeRef (extracts code or id automatically).
     * @param typeOrRef Type identifier string, or a ContentObjectTypeRef from a content object
     */
    resolve(typeOrRef: string | ContentObjectTypeRef): Promise<ContentObjectTypeItem | InCodeTypeDefinition> {
        const typeId = typeof typeOrRef === 'string' ? typeOrRef : (typeOrRef.code || typeOrRef.id!);
        return this.get(`/resolve/${typeId}`);
    }
}
