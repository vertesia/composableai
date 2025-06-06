import { VertesiaClient } from "@vertesia/client";
import { ToolExecutionPayload, ToolFn, ToolFunctionParams } from "./types.js";

export class ToolRegistry {

    registry: Record<string, ToolFn> = {};

    constructor(tools: ToolFn[] = []) {
        for (const tool of tools) {
            this.registry[tool.name] = tool;
        }
    }

    getTool(name: string): ToolFn | undefined {
        return this.registry[name];
    }

    runTool(name: string, params: ToolFunctionParams): Promise<any> {
        const toolFn = this.registry[name];
        if (!toolFn) {
            throw new ToolNotFoundError(name);
        }
        return toolFn(params);
    }

    // Overload signatures
    registerTool(name: string, tool: ToolFn): void;
    registerTool(tool: ToolFn): void;

    // Implementation
    registerTool(...args: [string, ToolFn] | [ToolFn]): void {
        if (args.length === 1) {
            const tool = args[0];
            if (typeof tool !== "function") {
                throw new Error("Tool must be a function");
            }
            this.registry[tool.name] = tool;
        } else {
            const [name, tool] = args;
            this.registry[name] = tool;
        }
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

        const toolFn = this.registry[payload.tool_name]
        if (toolFn === undefined) {
            throw new ToolNotFoundError(payload.tool_name);
        }
        return toolFn({
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