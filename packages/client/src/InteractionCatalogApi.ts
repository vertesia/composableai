import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    CatalogInteractionRef,
    InCodeInteraction
} from "@vertesia/common";


export class InteractionCatalogApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/interactions/catalog");
    }

    /**
     * List all project interactions
     * @param latestPublished Whether to fetch the latest published version or the draft version. Defaults to false (draft).
     */
    list(query: { latestPublished?: boolean, tag?: string } = {}): Promise<CatalogInteractionRef[]> {
        return this.get("/", {
            query
        });
    }

    /**
     * List all stored interactions
     * @param latestPublished Whether to fetch the latest published version or the draft version. Defaults to false (draft).
     */
    listStoredInteractions(query: { latestPublished?: boolean, tag?: string } = {}): Promise<CatalogInteractionRef[]> {
        return this.get("/stored", {
            query
        });
    }

    /**
     * List sys interactions
     */
    listSysInteractions(tag?: string): Promise<CatalogInteractionRef[]> {
        return this.get(`/sys`, {
            query: {
                tag
            }
        });
    }

    /**
     * List sys interactions
     */
    listAppInteractions(appName: string, tag?: string): Promise<CatalogInteractionRef[]> {
        return this.get(`/apps/${appName}`, {
            query: {
                tag
            }
        });
    }

    /**
     * List all app interactions
     */
    listAllAppInteractions(tag?: string): Promise<CatalogInteractionRef[]> {
        return this.get(`/apps`, {
            query: {
                tag
            }
        });
    }

    /**
     * Resolve an interaction given its id to a InCodeInteraction
     * @param id Interaction id
     */
    resolve(id: string): Promise<InCodeInteraction> {
        return this.get(`/resolve/${id}`);
    }
}
