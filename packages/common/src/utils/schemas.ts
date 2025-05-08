import { JSONSchema, PromptRole } from "@llumiverse/core";
import { JSONSchema4 } from "json-schema";
import { InteractionRefWithSchema, PopulatedInteraction } from "../interaction.js";
import { PopulatedPromptSegmentDef, PromptSegmentDef, PromptSegmentDefType, PromptTemplateRefWithSchema } from "../prompt.js";


export function mergeJSONSchemas(schemas: JSONSchema[]) {
    const props: Record<string, JSONSchema4> = {};
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
    const schema = Object.keys(props).length > 0 ? { properties: props, required, type: 'object' } as JSONSchema : null;
    return schema;
}

export function _mergePromptsSchema(prompts: PromptSegmentDef<PromptTemplateRefWithSchema>[] | PopulatedPromptSegmentDef[]) {
    const props: Record<string, JSONSchema4> = {};
    let required: string[] = [];
    for (const prompt of prompts) {
        if (prompt.template?.inputSchema?.properties) {
            const schema = prompt.template?.inputSchema;
            if (schema.required) {
                for (const prop of schema.required as string[]) {
                    if (!required.includes(prop)) required.push(prop);
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
            required.push('chat');
        }
    }
    return Object.keys(props).length > 0 ? { properties: props, required } as JSONSchema4 : null;
}

export function mergePromptsSchema(interaction: InteractionRefWithSchema | PopulatedInteraction) {
    if (!interaction.prompts) return null;
    return _mergePromptsSchema(interaction.prompts);
}
