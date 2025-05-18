import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import type { PluginManifest } from "@vertesia/common";

export default class PluginsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/plugins")
    }

    create(manifest: Omit<PluginManifest, 'id'>): Promise<PluginManifest> {
        return this.post('/', { payload: manifest });
    }

    update(manifest: PluginManifest) {
        return this.put(`/${manifest.id}`, { payload: manifest });
    }

    /**
     * @param ids - ids to filter by
     * @returns
     */
    list(ids?: string[]): Promise<PluginManifest[]> {
        return this.get('/', {
            query: {
                ids: ids ? ids.join(',') : undefined,
            }
        });
    }

}
