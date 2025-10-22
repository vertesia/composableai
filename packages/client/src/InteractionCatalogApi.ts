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
    list(latestPublished = false): Promise<CatalogInteractionRef[]> {
        return this.get("/", {
            query: { latestPublished }
        });
    }

    /**
     * List all stored interactions
     * @param latestPublished Whether to fetch the latest published version or the draft version. Defaults to false (draft).
     */
    listStoredInteractions(latestPublished = false): Promise<CatalogInteractionRef[]> {
        return this.get("/stored", {
            query: { latestPublished }
        });
    }

    /**
     * List sys interactions
     */
    listSysInteractions(): Promise<CatalogInteractionRef[]> {
        return this.get(`/sys`);
    }

    /**
     * List sys interactions
     */
    listAppInteractions(appName: string): Promise<CatalogInteractionRef[]> {
        return this.get(`/apps/${appName}`);
    }

    /**
     * List all app interactions
     */
    listAllAppInteractions(): Promise<CatalogInteractionRef[]> {
        return this.get(`/apps`);
    }

    /**
     * Resolve an interaction given its id to a InCodeInteraction
     * @param id Interaction id
     */
    resolve(id: string): Promise<InCodeInteraction> {
        return this.get(`/resolve/${id}`);
    }
}
