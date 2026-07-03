import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    AggregatedTool,
    ListProjectToolsQuery,
    ValidateToolNamesPayload,
    ValidateToolNamesResponse,
} from '@vertesia/common';

/**
 * Project-scoped unified tool registry.
 *
 * Wraps:
 *  - `GET  /api/v1/tools`         — list every tool visible to the current principal across all sources
 *  - `POST /api/v1/tools/validate` — resolve a list of names against the same registry
 *
 * This is the canonical client for tool discovery and validation.
 */
export default class ToolsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/tools');
    }

    /**
     * List the project's unified tool registry as seen by the current principal.
     * Use `sources` for an allowlist or `exclude` for a denylist. Excluded sources
     * are not fetched, so denylisting `'app'` skips the per-installation HTTP calls.
     *
     * **Interactive UI consumers should prefer `{ exclude: ['app'] }`** and fetch
     * app tools directly via `client.apps.getInstalledApps()` + per-app
     * `client.apps.listAppInstallationTools(id)`. Reason: app tools require N
     * per-installation HTTP fetches; doing them browser-side keeps studio-server's
     * fetch budget free, lets one slow app fail in isolation, and exploits browser
     * parallelism. Server-side aggregation of the `app` source is intended for
     * one-shot consumers (validation, CLI, agent tools) — not hot UI paths.
     */
    list(query?: ListProjectToolsQuery): Promise<AggregatedTool[]> {
        const params: Record<string, string> = {};
        if (query?.sources?.length) params.sources = query.sources.join(',');
        if (query?.exclude?.length) params.exclude = query.exclude.join(',');
        return this.get('/', { query: Object.keys(params).length > 0 ? params : undefined });
    }

    /**
     * List only Vertesia-provided builtin tools and system skills.
     */
    listBuiltins(): Promise<AggregatedTool[]> {
        return this.list({ sources: ['builtin'] });
    }

    /**
     * Validate a list of tool names. Each result reports validity, source, app provenance,
     * and (for invalid names) a closest-match suggestion.
     */
    validate(names: string[]): Promise<ValidateToolNamesResponse> {
        return this.post('/validate', { payload: { names } satisfies ValidateToolNamesPayload });
    }
}
