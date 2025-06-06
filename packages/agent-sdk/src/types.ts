import { VertesiaClient } from "@vertesia/client"
import { ToolDefinition } from "@llumiverse/common";

export interface ToolExecutionPayload<ParamsT extends Record<string, any>> {
    context: {
        serverUrl: string,
        storeUrl: string,
        apikey: string
    }
    vars: Record<string, any>,
    tool_input: ParamsT,
    tool_name: string,
}

export interface ToolFunctionParams<ParamsT extends Record<string, any>> {
    client: VertesiaClient,
    vars: Record<string, any>,
    input: ParamsT,
}

export type ToolFn<ParamsT extends Record<string, any>> = (params: ToolFunctionParams<ParamsT>) => Promise<any>;

export interface Tool<ParamsT extends Record<string, any>> extends ToolDefinition {
    run: ToolFn<ParamsT>;
}

export type { ToolDefinition };
