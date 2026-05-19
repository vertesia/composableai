import type { JSONSchema, ToolDefinition } from "@llumiverse/common";
import { PromptRole } from "@llumiverse/common";
import { InCodePrompt, InteractionRefWithSchema, PopulatedInteraction } from "../interaction.js";
import { ExecutablePromptSegmentDef, PromptSegmentDefType } from "../prompt.js";

/**
 * Sanitize a tool definition to only include fields expected by LLM APIs.
 * Removes extra fields like 'category', 'default', 'tools' that are
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

// Remove custom properties from the JSON before sending further down execution pipeline.
// Before stripping UI-only fields (editor, format), translate them into LLM-friendly
// schema hints so the model knows the expected value format.
export function removeExtraProperties<T>(schema: T): T {
    if (!schema) return schema;
    if (Array.isArray(schema)) {
        for (const item of schema) {
            removeExtraProperties(item);
        }
    } else if (typeof schema === 'object') {
        const obj = schema as Record<string, any>;

        // If this looks like a property definition (has editor/format for document/media),
        // enrich it with type and description hints before stripping.
        if (isDocumentProperty(obj)) {
            enrichDocumentProperty(obj);
        }

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

/**
 * Returns true if the schema property represents a document reference
 * (identified by editor: "document" or format: "document" / "media").
 */
function isDocumentProperty(obj: Record<string, any>): boolean {
    return obj.editor === 'document' ||
        obj.format === 'document' ||
        obj.format === 'media';
}

/**
 * Canonical hint string appended to document property descriptions.
 * Used by ensureDocumentStorePrefix (in @dglabs/workflows) to detect document
 * properties after serialization, when editor/format fields have been stripped.
 * Exported so both packages use the exact same string — do NOT duplicate.
 */
export const DOCUMENT_STORE_HINT = "Use 'store:<document_id>' format to reference a document from the content store.";

/**
 * Enriches a document property schema with LLM-friendly hints:
 * - Sets type to "string" if not already set
 * - Appends a store: prefix hint to the description
 */
function enrichDocumentProperty(obj: Record<string, any>): void {
    // Set type to string if missing (document references are string IDs)
    if (!obj.type) {
        obj.type = 'string';
    }

    // Always ensure the canonical hint is present in the description.
    // Check for the exact hint string (not just 'store:') to avoid missing detection
    // after serialization when only the description survives.
    if (!obj.description) {
        obj.description = DOCUMENT_STORE_HINT;
    } else if (!obj.description.includes(DOCUMENT_STORE_HINT)) {
        obj.description = `${obj.description} ${DOCUMENT_STORE_HINT}`;
    }
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