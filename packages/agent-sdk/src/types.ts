import { VertesiaClient } from "@vertesia/client"

export interface ToolExecutionPayload {
    context: {
        serverUrl: string,
        storeUrl: string,
        apikey: string
    }
    vars: Record<string, any>,
    tool_input: Record<string, any> | null | undefined,
    tool_name: string,
}

export interface ToolFunctionParams {
    client: VertesiaClient,
    vars: Record<string, any>,
    input: Record<string, any> | null | undefined,
}

export type ToolFn = (params: ToolFunctionParams) => Promise<any>;
