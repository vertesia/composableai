import { Ajv, ValidateFunction } from "ajv";
import { HTTPException } from "hono/http-exception";
import { Tool, ToolDefinitionWithDefault, ToolExecutionContext, ToolExecutionPayload, ToolExecutionResult } from "./types.js";

// Singleton AJV instance with coercion enabled for LLM compatibility
const ajv = new Ajv({
    coerceTypes: true,      // Coerce strings to numbers, booleans, etc.
    useDefaults: true,      // Apply default values from schema
    removeAdditional: true, // Remove properties not in schema
    allErrors: true,        // Report all errors, not just first
});

/**
 * Options for filtering tool definitions
 */
export interface ToolFilterOptions {
    /**
     * If true, only return tools that are available by default (default !== false).
     * If false or undefined, return all tools.
     */
    defaultOnly?: boolean;
    /**
     * List of tool names that are unlocked (available even if default: false).
     * These tools will be included even when defaultOnly is true.
     */
    unlockedTools?: string[];
}

export class ToolRegistry {

    registry: Record<string, Tool<any>> = {};
    validators: Record<string, ValidateFunction> = {};

    constructor(tools: Tool<any>[] = []) {
        for (const tool of tools) {
            this.registry[tool.name] = tool;
            // Pre-compile validators for each tool's input schema
            if (tool.input_schema) {
                try {
                    this.validators[tool.name] = ajv.compile(tool.input_schema);
                } catch (err) {
                    console.warn(`Failed to compile schema for tool ${tool.name}:`, err);
                }
            }
        }
    }

    /**
     * Get tool definitions with optional filtering.
     * @param options - Filtering options
     * @returns Filtered tool definitions
     */
    getDefinitions(options?: ToolFilterOptions): ToolDefinitionWithDefault[] {
        const { defaultOnly, unlockedTools = [] } = options || {};
        const unlockedSet = new Set(unlockedTools);

        return Object.values(this.registry)
            .filter(tool => {
                // If not filtering by default, include all tools
                if (!defaultOnly) return true;

                // Include if tool is default (default !== false) or is in unlocked list
                const isDefault = tool.default !== false;
                const isUnlocked = unlockedSet.has(tool.name);
                return isDefault || isUnlocked;
            })
            .map(tool => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.input_schema,
                default: tool.default,
            }));
    }

    /**
     * Get tools that are in reserve (default: false and not unlocked).
     * @param unlockedTools - List of tool names that are unlocked
     * @returns Tool definitions for reserve tools
     */
    getReserveTools(unlockedTools: string[] = []): ToolDefinitionWithDefault[] {
        const unlockedSet = new Set(unlockedTools);

        return Object.values(this.registry)
            .filter(tool => tool.default === false && !unlockedSet.has(tool.name))
            .map(tool => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.input_schema,
                default: tool.default,
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
        // Compile validator for the tool's input schema
        if (tool.input_schema) {
            try {
                this.validators[tool.name] = ajv.compile(tool.input_schema);
            } catch (err) {
                console.warn(`Failed to compile schema for tool ${tool.name}:`, err);
            }
        }
    }

    runTool<ParamsT extends Record<string, any>>(payload: ToolExecutionPayload<ParamsT>, context: ToolExecutionContext): Promise<ToolExecutionResult> {
        const toolName = payload.tool_use.tool_name;
        const tool = this.getTool<ParamsT>(toolName);

        // Validate input against schema if validator exists
        const validator = this.validators[toolName];
        if (validator) {
            const input = payload.tool_use.tool_input;
            const valid = validator(input);
            if (!valid) {
                throw new ToolInputValidationError(toolName, validator.errors || []);
            }
        }

        return tool.run(payload, context);
    }

}


export class ToolNotFoundError extends HTTPException {
    constructor(name: string) {
        super(404, { message: "Tool function not found: " + name });
        this.name = "ToolNotFoundError";
    }
}

export class ToolInputValidationError extends HTTPException {
    constructor(toolName: string, errors: Array<{ instancePath?: string; message?: string; keyword?: string; params?: Record<string, unknown> }>) {
        const errorMessages = errors.map(e => {
            const path = e.instancePath || '/';
            const msg = e.message || 'validation failed';
            return `${path}: ${msg}`;
        }).join('; ');
        super(400, { message: `Invalid input for tool '${toolName}': ${errorMessages}` });
        this.name = "ToolInputValidationError";
    }
}

