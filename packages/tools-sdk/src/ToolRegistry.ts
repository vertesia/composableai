import { AgentToolDefinition } from "@vertesia/common";
import { HTTPException } from "hono/http-exception";
import { Tool, ToolExecutionContext, ToolExecutionPayload, ToolExecutionResult, ToolUseContext } from "./types.js";


export class ToolRegistry {

    // The category name usinfg this registry
    category: string;
    registry: Record<string, Tool<any>> = {};

    constructor(category: string, tools: Tool<any>[] = []) {
        this.category = category;
        for (const tool of tools) {
            this.registry[tool.name] = tool;
        }
    }

    /**
     * Get tool definitions with optional filtering.
     * @param options - Filtering options
     * @returns Filtered tool definitions
     */
    getDefinitions(context?: ToolUseContext): AgentToolDefinition[] {
        const mapTool = (tool: Tool<any>): AgentToolDefinition => ({
            url: `tools/${this.category}`,
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
            category: this.category,
            default: tool.default,
        });
        let tools = Object.values(this.registry);
        if (context) {
            tools = tools.filter(tool => {
                return tool.isEnabled ? tool.isEnabled(context) : true;
            });
        }
        return tools.map(mapTool);
    }

    getTool<ParamsT extends Record<string, any>>(name: string): Tool<ParamsT> {
        const tool = this.registry[name]
        if (tool === undefined) {
            throw new ToolNotFoundError(name);
        }
        return tool;
    }

    getTools() {
        return Object.values(this.registry);
    }

    registerTool<ParamsT extends Record<string, any>>(tool: Tool<ParamsT>): void {
        this.registry[tool.name] = tool;
    }

    runTool<ParamsT extends Record<string, any>>(payload: ToolExecutionPayload<ParamsT>, context: ToolExecutionContext): Promise<ToolExecutionResult> {
        const toolName = payload.tool_use.tool_name;
        const toolUseId = payload.tool_use.id;
        const runId = payload.metadata?.run_id;
        console.log(`[ToolRegistry] Executing tool: ${toolName}`, {
            toolUseId,
            runId,
            input: sanitizeInput(payload.tool_use.tool_input),
        });
        return this.getTool(toolName).run(payload, context);
    }

}


export class ToolNotFoundError extends HTTPException {
    constructor(name: string) {
        super(404, { message: "Tool function not found: " + name });
        this.name = "ToolNotFoundError";
    }
}

const SENSITIVE_KEYS = new Set([
    'apikey', 'api_key', 'token', 'secret', 'password', 'credential', 'credentials',
    'authorization', 'auth', 'key', 'private_key', 'access_token', 'refresh_token'
]);

function sanitizeInput(input: Record<string, any> | null | undefined): Record<string, any> | null {
    if (!input) return null;

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('secret')) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'string' && value.length > 50) {
            sanitized[key] = value.slice(0, 50) + '...';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = Array.isArray(value) ? `[Array(${value.length})]` : '[Object]';
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}