import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { authorize } from "./auth.js";
import { ToolRegistry } from "./ToolRegistry.js";
import type { Tool, ToolDefinition, ToolExecutionPayload, ToolExecutionResponse, ToolExecutionResponseError } from "./types.js";

export interface ToolCollectionProperties {
    /**
     * A kebab case collection name. Must only contains alphanumeric and dash characters,
     * The name can be used to generate the path where the collection is exposed.
     * Example: my-collection
     */
    name: string;
    /**
     * Optional title for UI display. 
     * If not provided the pascal case version of the name will be used
     */
    title?: string;
    /**
     * Optional icon for UI display
     */
    icon?: string;
    /**
     * A short description 
     */
    description: string;

    /**
     * The tools
     */
    tools: Tool<any>[];
}

/**
 * Implements a tools colection endpoint
 */
export class ToolCollection implements Iterable<Tool<any>> {

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
    description: string;
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
        this.tools = new ToolRegistry(tools);
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

    async execute(ctx: Context) {
        let payload: ToolExecutionPayload<any> | undefined;
        try {
            payload = await readPayload(ctx);
            const session = await authorize(ctx);
            const r = await this.tools.runTool(payload, session);
            return ctx.json({
                ...r,
                tool_use_id: payload.tool_use.id
            } satisfies ToolExecutionResponse);
        } catch (err: any) { // HTTPException ?
            const status = err.status || 500;
            return ctx.json({
                tool_use_id: payload?.tool_use.id || "undefined",
                error: err.message || "Error executing tool",
                status
            } satisfies ToolExecutionResponseError, status)
        }
    }

    getToolDefinitions(): ToolDefinition[] {
        return this.tools.getDefinitions();
    }

}


async function readPayload(ctx: Context) {
    try {
        return await ctx.req.json() as ToolExecutionPayload<any>;
    } catch (err: any) {
        throw new HTTPException(500, {
            message: "Failed to load execution request payload: " + err.message
        });
    }
}

function kebabCaseToTitle(name: string) {
    return name.split('-').map(p => p[0].toUpperCase() + p.substring(1)).join(' ');
}