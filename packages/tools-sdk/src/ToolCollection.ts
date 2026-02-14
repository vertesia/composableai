import { AgentToolDefinition } from "@vertesia/common";
import { existsSync, readdirSync, statSync } from "fs";
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { join } from "path";
import { pathToFileURL } from "url";
import { authorize } from "./auth.js";
import { ToolContext } from "./server/types.js";
import { ToolRegistry } from "./ToolRegistry.js";
import type { CollectionProperties, ICollection, Tool, ToolExecutionPayload, ToolExecutionResponse, ToolExecutionResponseError, ToolUseContext } from "./types.js";
import { kebabCaseToTitle } from "./utils.js";

export interface ToolCollectionProperties extends CollectionProperties {
    /**
     * The tools
     */
    tools: Tool<any>[];
}

/**
 * Implements a tools collection endpoint
 */
export class ToolCollection implements ICollection<Tool<any>> {

    /**
     * A kebab case collection name. Must only contains alphanumeric and dash characters,
     * The name can be used to generate the path where the collection is exposed.
     * Example: my-collection
     */
    name: string;
    /**
     * Optional title for UI display. 
     * If not provided the title will be generated form the kebab case name by replacing - with spaces and upper casing first letter in words.
     */
    title?: string;
    /**
     * Optional icon for UI display
     */
    icon?: string;
    /**
     * A short description 
     */
    description?: string;
    /**
     * The tool registry
     */
    tools: ToolRegistry;

    constructor({
        name, title, icon, description, tools
    }: ToolCollectionProperties) {
        this.name = name;
        this.title = title || kebabCaseToTitle(name);
        this.icon = icon;
        this.description = description;
        // we add the collection name info
        this.tools = new ToolRegistry(name, tools);
    }

    [Symbol.iterator](): Iterator<Tool<any>> {
        let index = 0;
        const tools = this.tools.getTools();

        return {
            next(): IteratorResult<Tool<any>> {
                if (index < tools.length) {
                    return { value: tools[index++], done: false };
                } else {
                    return { done: true, value: undefined };
                }
            }
        };
    }

    map<U>(callback: (tool: Tool<any>, index: number) => U): U[] {
        return this.tools.getTools().map(callback);
    }

    async execute(ctx: Context, preParsedPayload?: ToolExecutionPayload<any>): Promise<Response> {
        let payload: ToolExecutionPayload<any> | undefined = preParsedPayload;
        try {
            if (!payload) {
                payload = await readPayload(ctx);
            }
            const toolName = payload.tool_use?.tool_name;
            const toolUseId = payload.tool_use?.id;
            const endpointOverrides = payload.metadata?.endpoints;

            const runId = payload.metadata?.run_id;

            console.log(`[ToolCollection] Tool call received: ${toolName}`, {
                collection: this.name,
                toolUseId,
                runId,
                hasEndpointOverrides: !!endpointOverrides,
            });

            const session = await authorize(ctx, endpointOverrides, { toolName, toolUseId, runId });
            const r = await this.tools.runTool(payload, session);
            return ctx.json({
                ...r,
                tool_use_id: payload.tool_use.id
            } satisfies ToolExecutionResponse);
        } catch (err: any) { // HTTPException ?
            const status = err.status || 500;
            const toolName = payload?.tool_use?.tool_name;
            const toolUseId = payload?.tool_use?.id;

            console.error("[ToolCollection] Tool execution failed", {
                collection: this.name,
                tool: toolName,
                toolUseId,
                error: err.message,
                status,
                stack: err.stack,
            });

            return ctx.json({
                tool_use_id: toolUseId || "undefined",
                error: err.message || "Error executing tool",
                status
            } satisfies ToolExecutionResponseError, status)
        }
    }

    /**
     * Get tool definitions with optional filtering.
     * @param options - context for filtering
     * @returns Filtered tool definitions
     */
    getToolDefinitions(context?: ToolUseContext): AgentToolDefinition[] {
        return this.tools.getDefinitions(context);
    }

}


function readPayload(ctx: Context): ToolExecutionPayload<any> {
    const toolCtx = ctx as ToolContext;

    // Check if body was already parsed and validated by middleware
    if (toolCtx.payload) {
        return toolCtx.payload;
    }

    // If no payload, middleware couldn't parse/validate - return error
    throw new HTTPException(400, {
        message: 'Invalid or missing tool execution payload. Expected { tool_use: { id, tool_name, tool_input? }, metadata? }'
    });
}

/**
 * Load all tools from a directory.
 * Scans for .js files and imports tools that match naming convention.
 *
 * Directory structure:
 * ```
 * collection/
 *   tools/
 *     SearchFundsTool.js    # exports SearchFundsTool
 *     GetFundDetailsTool.js # exports GetFundDetailsTool
 * ```
 *
 * Naming convention: File should export a Tool with name matching *Tool pattern.
 *
 * @param toolsDir - Path to the tools directory (e.g., /path/to/collection/tools)
 * @returns Promise resolving to array of Tool objects
 */
export async function loadToolsFromDirectory(toolsDir: string): Promise<Tool<any>[]> {
    const tools: Tool<any>[] = [];

    if (!existsSync(toolsDir)) {
        console.warn(`Tools directory not found: ${toolsDir}`);
        return tools;
    }

    let entries: string[];
    try {
        entries = readdirSync(toolsDir);
    } catch {
        console.warn(`Could not read tools directory: ${toolsDir}`);
        return tools;
    }

    for (const entry of entries) {
        // Only process .js and .ts files that end with Tool
        if (!entry.endsWith('Tool.js') && !entry.endsWith('Tool.ts')) continue;
        if (entry.endsWith('.d.ts')) continue;

        const entryPath = join(toolsDir, entry);

        try {
            const stat = statSync(entryPath);
            if (!stat.isFile()) continue;

            // Dynamic import - need file:// URL for ESM
            const fileUrl = pathToFileURL(entryPath).href;
            const module = await import(fileUrl);

            // Find exported Tool (named export matching filename or any Tool export)
            const baseName = entry.replace(/\.(js|ts)$/, '');
            const tool = module[baseName] || module.default;

            if (tool && typeof tool.name === 'string' && typeof tool.run === 'function') {
                tools.push(tool);
            } else {
                console.warn(`No valid Tool export found in ${entry}`);
            }
        } catch (err) {
            console.warn(`Error loading tool from ${entry}:`, err);
        }
    }

    return tools;
}

