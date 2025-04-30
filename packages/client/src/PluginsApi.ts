import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import type { PluginManifest } from "@vertesia/ui-extension-sdk/manifest";

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
     * If a project ID is specified through the project query param
     * then only the plugins that are enabled on the project are returned.
     * @param query
     * @returns
     */
    list(): Promise<PluginManifest[]> {
        return this.get('/');
    }

}
