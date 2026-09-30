import type { AgentToolDefinition } from '@vertesia/common';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authorize } from './auth.js';
import type { ToolContext } from './server/types.js';
import { ToolRegistry } from './ToolRegistry.js';
import type {
    CollectionProperties,
    ICollection,
    Tool,
    ToolExecutionPayload,
    ToolExecutionResponse,
    ToolExecutionResponseError,
    ToolUseContext,
} from './types.js';
import { kebabCaseToTitle } from './utils.js';

export interface ToolCollectionProperties extends CollectionProperties {
    /**
     * The tools
     */
    tools: Tool[];
}

/**
 * Implements a tools collection endpoint
 */
export class ToolCollection implements ICollection<Tool> {
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

    constructor({ name, title, icon, description, tools }: ToolCollectionProperties) {
        this.name = name;
        this.title = title || kebabCaseToTitle(name);
        this.icon = icon;
        this.description = description;
        // we add the collection name info
        this.tools = new ToolRegistry(name, tools);
    }

    [Symbol.iterator](): Iterator<Tool> {
        let index = 0;
        const tools = this.tools.getTools();

        return {
            next(): IteratorResult<Tool> {
                if (index < tools.length) {
                    return { value: tools[index++], done: false };
                } else {
                    return { done: true, value: undefined };
                }
            },
        };
    }

    map<U>(callback: (tool: Tool, index: number) => U): U[] {
        return this.tools.getTools().map(callback);
    }

    async execute(ctx: Context, preParsedPayload?: ToolExecutionPayload): Promise<Response> {
        let payload: ToolExecutionPayload | undefined = preParsedPayload;
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
                tool_use_id: payload.tool_use.id,
            } satisfies ToolExecutionResponse);
        } catch (err: unknown) {
            // HTTPException ?
            const status = err instanceof HTTPException ? err.status : 500;
            const message = err instanceof Error ? err.message : 'Error executing tool';
            const stack = err instanceof Error ? err.stack : undefined;
            const toolName = payload?.tool_use?.tool_name;
            const toolUseId = payload?.tool_use?.id;

            console.error('[ToolCollection] Tool execution failed', {
                collection: this.name,
                tool: toolName,
                toolUseId,
                error: message,
                status,
                stack,
            });

            return ctx.json(
                {
                    tool_use_id: toolUseId || 'undefined',
                    error: message,
                    status,
                } satisfies ToolExecutionResponseError,
                status,
            );
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

function readPayload(ctx: Context): ToolExecutionPayload {
    const toolCtx = ctx as ToolContext;

    // Check if body was already parsed and validated by middleware
    if (toolCtx.payload) {
        return toolCtx.payload;
    }

    // If no payload, middleware couldn't parse/validate - return error
    throw new HTTPException(400, {
        message:
            'Invalid or missing tool execution payload. Expected { tool_use: { id, tool_name, tool_input? }, metadata? }',
    });
}
