import type { ToolDefinition, ToolUse } from "@llumiverse/common";
import { VertesiaClient } from "@vertesia/client";
import { AuthTokenPayload, ToolResult, ToolResultContent } from "@vertesia/common";

export interface ToolExecutionContext {
    /**
     * The raw JWT token to the tool execution request
     */
    token: string;
    /**
     * The decoded JWT token
     */
    payload: AuthTokenPayload;
    /**
     * Vertesia client factory using the current auth token.
     * @returns a vertesia client instance
     */
    getClient: () => Promise<VertesiaClient>;
}

export interface ToolExecutionResult extends ToolResultContent {
    /**
     * Medata can be used to return more info on the tool execution like stats or user messages.
     */
    metadata?: Record<string, any>;
}

export interface ToolExecutionResponse extends ToolExecutionResult, ToolResult {
    /**
     * The tool use id of the tool use request. For traceability.
     */
    tool_use_id: string;
}

export interface ToolExecutionResponseError {
    /**
     * The tool use id of the tool use request. For traceability.
     */
    tool_use_id: string;
    /**
     * The http status code
     */
    status: number;
    /**
     * the error message
     */
    error: string;
    /**
     * Additional context information
     */
    data?: Record<string, any>;
}

export interface ToolExecutionPayload<ParamsT extends Record<string, any>> {
    tool_use: ToolUse<ParamsT>,
    /**
     * Optional metadata related to the current execution request
     */
    metadata?: Record<string, any>,
}

export type ToolFn<ParamsT extends Record<string, any>> = (payload: ToolExecutionPayload<ParamsT>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;

export interface Tool<ParamsT extends Record<string, any>> extends ToolDefinition {
    run: ToolFn<ParamsT>;
}

export type { ToolDefinition };
