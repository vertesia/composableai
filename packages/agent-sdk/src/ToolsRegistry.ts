import { HTTPException } from "hono/http-exception";
import { Tool, ToolDefinition, ToolExecutionContext, ToolExecutionPayload, ToolExecutionResult } from "./types.js";
export class ToolsRegistry {

    registry: Record<string, Tool<any>> = {};

    constructor(tools: Tool<any>[] = []) {
        for (const tool of tools) {
            this.registry[tool.name] = tool;
        }
    }

    getDefinitions(): ToolDefinition[] {
        return Object.values(this.registry).map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema
        }));
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
        return this.getTool(payload.tool_use.tool_name).run(payload, context);
    }

}


export class ToolNotFoundError extends HTTPException {
    constructor(name: string) {
        super(404, { message: "Tool function not found: " + name });
        this.name = "ToolNotFoundError";
    }
}