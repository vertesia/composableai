/**
 * Data fetching hooks for the admin panel.
 */

import { useFetch } from '@vertesia/ui/core';
import type { ServerInfo, ResourceData } from './types.js';
import { buildResourceData } from './types.js';

/**
 * Fetches the tool server info (message, version, endpoints).
 */
export function useServerInfo(baseUrl: string) {
    return useFetch<ServerInfo>(() =>
        fetch(baseUrl).then(r => r.json()),
        [baseUrl]
    );
}

/**
 * Fetches all 5 resource endpoints in parallel and builds collections + flat resource list.
 * MCP endpoints are passed separately since they come from serverInfo.
 */
export function useResourceData(baseUrl: string, mcpEndpoints?: string[]) {
    return useFetch<ResourceData>(() => {
        const fetchJson = (path: string) => fetch(`${baseUrl}/${path}`).then(r => r.json());
        return Promise.all([
            fetchJson('interactions'),
            fetchJson('tools'),
            fetchJson('skills'),
            fetchJson('types'),
            fetchJson('templates'),
        ]).then(([interactions, tools, skills, types, templates]) =>
            buildResourceData(interactions, tools, skills, types, templates, mcpEndpoints)
        );
    }, [baseUrl, mcpEndpoints]);
}
