import { Tool, ToolExecutionPayload, ToolFunctionParams } from "./types.js";
export declare class ToolRegistry {
    registry: Record<string, Tool<any>>;
    constructor(tools?: Tool<any>[]);
    getDefinitions(): {
        name: string;
        description: string | undefined;
        input_schema: {
            [k: string]: unknown;
            type: "object";
            properties?: import("@llumiverse/common").JSONSchema | null | undefined;
        };
    }[];
    getTool<ParamsT extends Record<string, any>>(name: string): Tool<ParamsT> | undefined;
    runTool<ParamsT extends Record<string, any>>(name: string, params: ToolFunctionParams<ParamsT>): Promise<any>;
    registerTool<ParamsT extends Record<string, any>>(tool: Tool<ParamsT>): void;
    execute<ParamsT extends Record<string, any>>(postData: string | ToolExecutionPayload<ParamsT>): Promise<any>;
}
export declare class ToolNotFoundError extends Error {
    constructor(name: string);
}
//# sourceMappingURL=registry.d.ts.map