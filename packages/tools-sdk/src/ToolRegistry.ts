import type { AgentToolDefinition } from "@vertesia/common";
import { HTTPException } from "hono/http-exception";
import type { Tool, ToolExecutionContext, ToolExecutionPayload, ToolExecutionResult, ToolUseContext } from "./types.js";


export class ToolRegistry {

    // The category name usinfg this registry
    category: string;
    registry: Record<string, Tool> = {};

    constructor(category: string, tools: Tool[] = []) {
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
        const mapTool = (tool: Tool): AgentToolDefinition => ({
            url: `tools/${this.category}`,
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
            category: this.category,
            default: tool.default,
            ...(tool.annotations ? { annotations: tool.annotations } : {}),
            ...(tool.requires_user_confirmation ? { requires_user_confirmation: true } : {}),
        });
        let tools = Object.values(this.registry);
        if (context) {
            tools = tools.filter(tool => {
                return tool.isEnabled ? tool.isEnabled(context) : true;
            });
        }
        return tools.map(mapTool);
    }

    getTool<ParamsT extends object>(name: string): Tool<ParamsT> {
        const tool = this.registry[name]
        if (tool === undefined) {
            throw new ToolNotFoundError(name);
        }
        return tool as unknown as Tool<ParamsT>;
    }

    getTools() {
        return Object.values(this.registry);
    }

    registerTool<ParamsT extends object>(tool: Tool<ParamsT>): void {
        this.registry[tool.name] = tool as unknown as Tool;
    }

    runTool<ParamsT extends object>(payload: ToolExecutionPayload<ParamsT>, context: ToolExecutionContext): Promise<ToolExecutionResult> {
        const toolName = payload.tool_use.tool_name;
        return this.getTool(toolName).run(payload, context);
    }

}


export class ToolNotFoundError extends HTTPException {
    constructor(name: string) {
        super(404, { message: `Tool function not found: ${name}` });
        this.name = "ToolNotFoundError";
    }
}
