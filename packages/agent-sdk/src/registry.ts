import { VertesiaClient } from "@vertesia/client";
import { Tool, ToolExecutionPayload, ToolFunctionParams } from "./types.js";

export class ToolRegistry {

    registry: Record<string, Tool> = {};

    constructor(tools: Tool[] = []) {
        for (const tool of tools) {
            this.registry[tool.name] = tool;
        }
    }

    getTool(name: string): Tool | undefined {
        return this.registry[name];
    }

    runTool(name: string, params: ToolFunctionParams): Promise<any> {
        const tool = this.registry[name];
        if (!tool) {
            throw new ToolNotFoundError(name);
        }
        return tool.run(params);
    }

    // Implementation
    registerTool(tool: Tool): void {
        this.registry[tool.name] = tool;
    }

    execute(postData: string | ToolExecutionPayload) {
        let payload: ToolExecutionPayload;
        if (typeof postData === "string") {
            try {
                payload = JSON.parse(postData);
            } catch (e) {
                throw new Error("Invalid JSON string provided");
            }
        } else {
            payload = postData;
        }

        const tool = this.registry[payload.tool_name]
        if (tool === undefined) {
            throw new ToolNotFoundError(payload.tool_name);
        }
        return tool.run({
            client: new VertesiaClient({
                serverUrl: payload.context.serverUrl,
                storeUrl: payload.context.storeUrl,
                apikey: payload.context.apikey
            }),
            vars: payload.vars,
            input: payload.tool_input || null
        });
    }

}


export class ToolNotFoundError extends Error {
    constructor(name: string) {
        super("Tool function not found: " + name);
        this.name = "ToolNotFoundError";
    }
}