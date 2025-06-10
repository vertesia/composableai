import { VertesiaClient } from "@vertesia/client";
import { Tool, ToolExecutionPayload, ToolFunctionParams } from "./types.js";

export class ToolRegistry {

    registry: Record<string, Tool<any>> = {};

    constructor(tools: Tool<any>[] = []) {
        for (const tool of tools) {
            this.registry[tool.name] = tool;
        }
    }

    getDefinitions() {
        return Object.values(this.registry).map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema
        }));
    }

    getTool<ParamsT extends Record<string, any>>(name: string): Tool<ParamsT> | undefined {
        return this.registry[name];
    }

    runTool<ParamsT extends Record<string, any>>(name: string, params: ToolFunctionParams<ParamsT>): Promise<any> {
        const tool = this.registry[name];
        if (!tool) {
            throw new ToolNotFoundError(name);
        }
        return tool.run(params);
    }

    registerTool<ParamsT extends Record<string, any>>(tool: Tool<ParamsT>): void {
        this.registry[tool.name] = tool;
    }

    execute<ParamsT extends Record<string, any>>(postData: string | ToolExecutionPayload<ParamsT>) {
        let payload: ToolExecutionPayload<ParamsT>;
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
            input: payload.tool_input || {}
        });
    }

}


export class ToolNotFoundError extends Error {
    constructor(name: string) {
        super("Tool function not found: " + name);
        this.name = "ToolNotFoundError";
    }
}