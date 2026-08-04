/**
 * Data fetching hooks for the admin panel.
 */

import { useFetch } from '@vertesia/ui/core';

import type { ResourceData, ServerInfo } from './types.js';
import { buildResourceData } from './types.js';

type ResourceDataArgs = Parameters<typeof buildResourceData>;

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

/**
 * Fetches the tool server info (message, version, endpoints).
 */
export function useServerInfo(baseUrl: string) {
    return useFetch<ServerInfo>(() => fetchJson<ServerInfo>(baseUrl), [baseUrl]);
}

/**
 * Fetches all 5 resource endpoints in parallel and builds collections + flat resource list.
 * MCP endpoints are passed separately since they come from serverInfo.
 */
export function useResourceData(baseUrl: string, mcpEndpoints?: string[]) {
    return useFetch<ResourceData>(() => {
        const fetchResource = <T>(path: string) => fetchJson<T>(`${baseUrl}/${path}`);
        return Promise.all([
            fetchResource<ResourceDataArgs[0]>('interactions'),
            fetchResource<ResourceDataArgs[1]>('tools'),
            fetchResource<ResourceDataArgs[2]>('skills'),
            fetchResource<ResourceDataArgs[3]>('activities'),
            fetchResource<ResourceDataArgs[4]>('types'),
            fetchResource<ResourceDataArgs[5]>('templates'),
        ]).then(([interactions, tools, skills, activities, types, templates]) =>
            buildResourceData(interactions, tools, skills, activities, types, templates, mcpEndpoints),
        );
    }, [baseUrl, mcpEndpoints]);
}
