"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolNotFoundError = exports.ToolRegistry = void 0;
const client_1 = require("@vertesia/client");
class ToolRegistry {
    registry = {};
    constructor(tools = []) {
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
    getTool(name) {
        return this.registry[name];
    }
    runTool(name, params) {
        const tool = this.registry[name];
        if (!tool) {
            throw new ToolNotFoundError(name);
        }
        return tool.run(params);
    }
    registerTool(tool) {
        this.registry[tool.name] = tool;
    }
    execute(postData) {
        let payload;
        if (typeof postData === "string") {
            try {
                payload = JSON.parse(postData);
            }
            catch (e) {
                throw new Error("Invalid JSON string provided");
            }
        }
        else {
            payload = postData;
        }
        const tool = this.registry[payload.tool_name];
        if (tool === undefined) {
            throw new ToolNotFoundError(payload.tool_name);
        }
        return tool.run({
            client: new client_1.VertesiaClient({
                serverUrl: payload.context.serverUrl,
                storeUrl: payload.context.storeUrl,
                apikey: payload.context.apikey
            }),
            vars: payload.vars,
            input: payload.tool_input || {}
        });
    }
}
exports.ToolRegistry = ToolRegistry;
class ToolNotFoundError extends Error {
    constructor(name) {
        super("Tool function not found: " + name);
        this.name = "ToolNotFoundError";
    }
}
exports.ToolNotFoundError = ToolNotFoundError;
//# sourceMappingURL=registry.js.map