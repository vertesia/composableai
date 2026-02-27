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
    /** Unique identifier used for fetching details (e.g. "collection:name" for interactions). */
    id?: string;
    name: string;
    title: string;
    description: string;
    type: ResourceType;
    tags?: string[];
    url?: string;
}

/**
 * Metadata about a collection of resources, enriched with type and count client-side.
 */
export interface CollectionInfo {
    name: string;
    title: string;
    description: string;
    type: ResourceType;
    count: number;
}

/**
 * Collection metadata as returned by each API endpoint.
 */
interface CollectionMeta {
    name: string;
    title?: string;
    description?: string;
}

/**
 * Response shapes for each resource endpoint.
 */
interface InteractionsResponse {
    interactions: CatalogInteractionRef[];
    collections: CollectionMeta[];
}

interface ToolsResponse {
    tools: AgentToolDefinition[];
    collections: CollectionMeta[];
}

interface SkillsResponse {
    tools: AgentToolDefinition[];
    collections: CollectionMeta[];
}

interface TypesResponse {
    types: InCodeTypeDefinition[];
    collections: CollectionMeta[];
}

interface TemplatesResponse {
    templates: RenderingTemplateDefinitionRef[];
    collections: CollectionMeta[];
}

/**
 * Combined result of processing all endpoint responses.
 */
export interface ResourceData {
    collections: CollectionInfo[];
    resources: ResourceItem[];
}

/**
 * Formats a kebab/snake-case name into a title.
 */
function formatTitle(name: string): string {
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Counts items per collection by matching each item to a collection name.
 * If there is only one collection, all items belong to it.
 */
function countPerCollection<T>(
    items: T[],
    collections: CollectionMeta[],
    extractCollection: (item: T) => string | undefined,
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const col of collections) counts.set(col.name, 0);

    if (collections.length === 1) {
        counts.set(collections[0].name, items.length);
        return counts;
    }

    for (const item of items) {
        const colName = extractCollection(item);
        if (colName && counts.has(colName)) {
            counts.set(colName, (counts.get(colName) || 0) + 1);
        }
    }

    return counts;
}

/**
 * Builds collections and a flat resource list from the 5 endpoint responses + MCP endpoints.
 */
export function buildResourceData(
    interactionsResp: InteractionsResponse,
    toolsResp: ToolsResponse,
    skillsResp: SkillsResponse,
    typesResp: TypesResponse,
    templatesResp: TemplatesResponse,
    mcpEndpoints?: string[],
): ResourceData {
    const collections: CollectionInfo[] = [];
    const resources: ResourceItem[] = [];

    // --- Interactions (id format: "collection:name") ---
    const interCounts = countPerCollection(
        interactionsResp.interactions,
        interactionsResp.collections,
        (i) => i.id.split(':')[0],
    );
    for (const col of interactionsResp.collections) {
        collections.push({
            name: col.name,
            title: col.title || formatTitle(col.name),
            description: col.description || '',
            type: 'interaction',
            count: interCounts.get(col.name) || 0,
        });
    }
    for (const inter of interactionsResp.interactions) {
        resources.push({
            id: inter.id,
            name: inter.name,
            title: inter.title || formatTitle(inter.name),
            description: inter.description || '',
            type: 'interaction',
            tags: inter.tags,
        });
    }

    // --- Tools (url format: "tools/{collection}") ---
    const toolCounts = countPerCollection(
        toolsResp.tools,
        toolsResp.collections,
        (t) => t.url?.split('/').pop(),
    );
    for (const col of toolsResp.collections) {
        collections.push({
            name: col.name,
            title: col.title || formatTitle(col.name),
            description: col.description || '',
            type: 'tool',
            count: toolCounts.get(col.name) || 0,
        });
    }
    for (const tool of toolsResp.tools) {
        resources.push({
            name: tool.name,
            title: formatTitle(tool.name),
            description: tool.description || '',
            type: 'tool',
            url: tool.url,
        });
    }

    // --- Skills (url format: "skills/{collection}") ---
    const skillCounts = countPerCollection(
        skillsResp.tools,
        skillsResp.collections,
        (t) => t.url?.split('/').pop(),
    );
    for (const col of skillsResp.collections) {
        collections.push({
            name: col.name,
            title: col.title || formatTitle(col.name),
            description: col.description || '',
            type: 'skill',
            count: skillCounts.get(col.name) || 0,
        });
    }
    for (const skill of skillsResp.tools) {
        resources.push({
            name: skill.name,
            title: formatTitle(skill.name),
            description: skill.description || '',
            type: 'skill',
            url: skill.url,
        });
    }

    // --- Types (id format: "collection:pathName") ---
    const typeCounts = countPerCollection(
        typesResp.types,
        typesResp.collections,
        (t) => t.id?.split(':')[0],
    );
    for (const col of typesResp.collections) {
        collections.push({
            name: col.name,
            title: col.title || formatTitle(col.name),
            description: col.description || '',
            type: 'type',
            count: typeCounts.get(col.name) || 0,
        });
    }
    for (const t of typesResp.types) {
        resources.push({
            name: t.name,
            title: formatTitle(t.name),
            description: t.description || '',
            type: 'type',
            tags: t.tags,
        });
    }

    // --- Templates (path format: "/api/templates/{collection}/{name}") ---
    const tmplCounts = countPerCollection(
        templatesResp.templates,
        templatesResp.collections,
        (t) => {
            const segments = t.path?.split('/');
            return segments && segments.length >= 4 ? segments[3] : undefined;
        },
    );
    for (const col of templatesResp.collections) {
        collections.push({
            name: col.name,
            title: col.title || formatTitle(col.name),
            description: col.description || '',
            type: 'template',
            count: tmplCounts.get(col.name) || 0,
        });
    }
    for (const tmpl of templatesResp.templates) {
        resources.push({
            name: tmpl.name,
            title: tmpl.title || formatTitle(tmpl.name),
            description: tmpl.description || '',
            type: 'template',
            tags: tmpl.tags,
            url: tmpl.path,
        });
    }

    // --- MCP (derived from serverInfo, no endpoint) ---
    for (const endpoint of mcpEndpoints || []) {
        const name = endpoint.split('/').pop() || endpoint;
        resources.push({
            name,
            title: formatTitle(name),
            description: '',
            type: 'mcp',
            url: endpoint,
        });
    }

    return { collections, resources };
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
