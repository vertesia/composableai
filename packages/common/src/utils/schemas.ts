import type { JSONSchema, ToolDefinition } from "@llumiverse/common";
import { PromptRole } from "@llumiverse/common";
import { InCodePrompt, InteractionRefWithSchema, PopulatedInteraction } from "../interaction.js";
import { ExecutablePromptSegmentDef, PromptSegmentDefType } from "../prompt.js";

/**
 * Sanitize a tool definition to only include fields expected by LLM APIs.
 * Removes extra fields like 'category', 'default', 'related_tools' that are
 * used internally but should not be sent to the LLM.
 */
export function sanitizeToolDefinition(tool: ToolDefinition): ToolDefinition {
    return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
    };
}

/**
 * Sanitize an array of tool definitions.
 */
export function sanitizeToolDefinitions(tools: ToolDefinition[] | undefined): ToolDefinition[] | undefined {
    if (!tools) return tools;
    return tools.map(sanitizeToolDefinition);
}

// Remove custom properties from the JSON before sending further down execution pipeline
export function removeExtraProperties<T>(schema: T): T {
    if (!schema) return schema;
    if (Array.isArray(schema)) {
        for (const item of schema) {
            removeExtraProperties(item);
        }
    } else if (typeof schema === 'object') {
        const obj = schema as Record<string, any>;
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'editor' && (value === 'textarea' || value === 'document' || value === 'media')) {
                delete obj[key];
            } else if (key === 'format' && (value === 'textarea' || value === 'document' || value === 'media')) {
                delete obj[key];
            } else if (typeof value === 'object') {
                removeExtraProperties(value)
            }
        }
    }
    return schema;
}

export function mergeJSONSchemas(schemas: JSONSchema[]) {
    const props: Record<string, JSONSchema> = {};
    let required: string[] = [];
    for (const schema of schemas) {
        if (schema.properties) {
            if (schema.required) {
                for (const prop of schema.required as string[]) {
                    if (!required.includes(prop)) required.push(prop);
                }
            }
            Object.assign(props, schema.properties);
        }
    }
    const schema: JSONSchema | null = Object.keys(props).length > 0 ? { properties: props, required, type: 'object' } : null;
    return schema;
}

export function _mergePromptsSchema(prompts: ExecutablePromptSegmentDef[]) {
    const props: Record<string, JSONSchema> = {};
    let required = new Set<string>();
    for (const prompt of prompts) {
        if (prompt.template?.inputSchema?.properties) {
            const schema = prompt.template?.inputSchema;
            if (schema.required) {
                for (const prop of schema.required as string[]) {
                    required.add(prop);
                }
            }
            Object.assign(props, schema.properties);
        } else if (prompt.type === PromptSegmentDefType.chat) {
            Object.assign(props, {
                chat: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            role: {
                                type: 'string',
                                enum: [PromptRole.assistant, PromptRole.user]
                            },
                            content: { type: 'string' },
                        },
                        required: ['role', 'content']
                    }
                }
            });
            required.add('chat');
        }
    }
    
    const schema: JSONSchema | null = Object.keys(props).length > 0 ? {
        properties: props,
        required: Array.from(required)
    } : null;
    return schema;
}

export function mergePromptsSchema(interaction: InteractionRefWithSchema | PopulatedInteraction) {
    if (!interaction.prompts) return null;
    return _mergePromptsSchema(interaction.prompts as ExecutablePromptSegmentDef[]);
}

export function mergeInCodePromptSchemas(prompts: InCodePrompt[]) {
    const props: Record<string, JSONSchema> = {};
    let required = new Set<string>();
    for (const prompt of prompts) {
        if (prompt.schema?.properties) {
            const schema = prompt.schema;
            if (schema.required) {
                for (const prop of schema.required as string[]) {
                    required.add(prop);
                }
            }
            Object.assign(props, schema.properties);
        }
    }
    const schema: JSONSchema | null = Object.keys(props).length > 0 ? {
        properties: props,
        required: Array.from(required)
    } : null;
    return schema;
}