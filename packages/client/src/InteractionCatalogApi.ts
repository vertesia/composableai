import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CatalogAgentSearchQuery,
    CatalogCallSearchQuery,
    CatalogInteractionRef,
    CatalogSearchResult,
    InteractionStatus,
    ResolvedCatalogInteraction,
} from '@vertesia/common';

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
     * Search the stored agents of the project: the interactions configured as agents
     * (`agent_runner_options.is_agent`), in their draft version.
     */
    listStoredAgents(query: CatalogAgentSearchQuery = {}): Promise<CatalogSearchResult> {
        return this.get('/agents/stored', { query });
    }

    /** Search the system agents, which are defined in code by the platform. */
    listSystemAgents(query: CatalogAgentSearchQuery = {}): Promise<CatalogSearchResult> {
        return this.get('/agents/system', { query });
    }

    /** Search the agents provided by an app. The app is asked for its interactions, so this can be slow. */
    listAppAgents(appName: string, query: CatalogAgentSearchQuery = {}): Promise<CatalogSearchResult> {
        return this.get(`/agents/apps/${encodeURIComponent(appName)}`, { query });
    }

    /**
     * Search the stored calls of the project: the interactions that are not agents (basic, tool and skill calls),
     * in their draft version.
     */
    listStoredCalls(query: CatalogCallSearchQuery = {}): Promise<CatalogSearchResult> {
        return this.get('/calls/stored', { query });
    }

    /** Search the system calls, which are defined in code by the platform. */
    listSystemCalls(query: CatalogCallSearchQuery = {}): Promise<CatalogSearchResult> {
        return this.get('/calls/system', { query });
    }

    /** Search the calls provided by an app. The app is asked for its interactions, so this can be slow. */
    listAppCalls(appName: string, query: CatalogCallSearchQuery = {}): Promise<CatalogSearchResult> {
        return this.get(`/calls/apps/${encodeURIComponent(appName)}`, { query });
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
