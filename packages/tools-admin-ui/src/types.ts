/**
 * Types for the admin panel
 */

import type {
    AgentToolDefinition,
    CatalogInteractionRef,
    InCodeTypeDefinition,
    RenderingTemplateDefinitionRef,
} from '@vertesia/common';

/**
 * Server info from GET /api
 */
export interface ServerInfo {
    message: string;
    version: string;
    endpoints: {
        tools: string[];
        interactions: string[];
        templates: string[];
        mcp: string[];
    };
}

export type ResourceType = 'tool' | 'skill' | 'interaction' | 'type' | 'template' | 'mcp';

/**
 * A normalized resource entry for display and search.
 */
export interface ResourceItem {
    name: string;
    title: string;
    description: string;
    type: ResourceType;
    tags?: string[];
    url?: string;
}

/**
 * Formats a kebab/snake-case name into a title.
 */
function formatTitle(name: string): string {
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Builds a flat list of searchable resources from AppPackage data + MCP endpoints.
 */
export function buildResources(
    tools?: AgentToolDefinition[],
    interactions?: CatalogInteractionRef[],
    types?: InCodeTypeDefinition[],
    templates?: RenderingTemplateDefinitionRef[],
    mcpEndpoints?: string[],
): ResourceItem[] {
    const items: ResourceItem[] = [];

    for (const tool of tools || []) {
        const isSkill = tool.url?.includes('/skills/');
        items.push({
            name: tool.name,
            title: formatTitle(tool.name),
            description: tool.description || '',
            type: isSkill ? 'skill' : 'tool',
            url: tool.url,
        });
    }

    for (const inter of interactions || []) {
        items.push({
            name: inter.name,
            title: inter.title || formatTitle(inter.name),
            description: inter.description || '',
            type: 'interaction',
            tags: inter.tags,
        });
    }

    for (const t of types || []) {
        items.push({
            name: t.name,
            title: formatTitle(t.name),
            description: t.description || '',
            type: 'type',
            tags: t.tags,
        });
    }

    for (const tmpl of templates || []) {
        items.push({
            name: tmpl.name,
            title: tmpl.title || formatTitle(tmpl.name),
            description: tmpl.description || '',
            type: 'template',
            tags: tmpl.tags,
            url: tmpl.path,
        });
    }

    for (const endpoint of mcpEndpoints || []) {
        const name = endpoint.split('/').pop() || endpoint;
        items.push({
            name,
            title: formatTitle(name),
            description: '',
            type: 'mcp',
            url: endpoint,
        });
    }

    return items;
}

/**
 * Filters resources by a search query, matching against name, title, description, type, and tags.
 */
export function filterResources(items: ResourceItem[], query: string): ResourceItem[] {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.type.includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q))
    );
}
