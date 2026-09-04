import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { CatalogInteractionRef, InteractionStatus, ResolvedCatalogInteraction } from '@vertesia/common';

export class InteractionCatalogApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/interactions/catalog');
    }

    /**
     * List all project interactions
     */
    list(query: { status?: InteractionStatus; tag?: string } = {}): Promise<CatalogInteractionRef[]> {
        return this.get('/', {
            query,
        });
    }

    /**
     * List all stored interactions
     */
    listStoredInteractions(query: { status?: InteractionStatus; tag?: string } = {}): Promise<CatalogInteractionRef[]> {
        return this.get('/stored', {
            query,
        });
    }

    /**
     * List sys interactions
     */
    listSysInteractions(tag?: string): Promise<CatalogInteractionRef[]> {
        return this.get(`/sys`, {
            query: {
                tag,
            },
        });
    }

    /**
     * List sys interactions
     */
    listAppInteractions(appName: string, tag?: string): Promise<CatalogInteractionRef[]> {
        return this.get(`/apps/${appName}`, {
            query: {
                tag,
            },
        });
    }

    /**
     * List all app interactions
     */
    listAllAppInteractions(tag?: string): Promise<CatalogInteractionRef[]> {
        return this.get(`/apps`, {
            query: {
                tag,
            },
        });
    }

    /**
     * Resolve an interaction by ID to its complete executable definition.
     * @param id Interaction id
     */
    resolve(id: string): Promise<ResolvedCatalogInteraction> {
        return this.get(`/resolve/${id}`);
    }
}
