import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import { ContentObjectTypeItem, InCodeTypeDefinition } from '@vertesia/common';


export class TypeCatalogApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/types/catalog');
    }

    /**
     * List all content types (system + app + stored)
     */
    list(query: { tag?: string } = {}): Promise<ContentObjectTypeItem[]> {
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
    listStoredTypes(tag?: string): Promise<ContentObjectTypeItem[]> {
        return this.get('/stored', {
            query: { tag }
        });
    }

    /**
     * Resolve a type ID to its full definition
     * @param typeId Type identifier (sys:name, app:appName:name, or ObjectId)
     */
    resolve(typeId: string): Promise<ContentObjectTypeItem | InCodeTypeDefinition> {
        return this.get(`/resolve/${typeId}`);
    }
}
