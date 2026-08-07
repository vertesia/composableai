import type { JSONSchema } from '@llumiverse/common';
import type { InCodePrompt } from '../interaction.js';

export function mergeInCodePromptSchemas(prompts: InCodePrompt[]) {
    const props: Record<string, JSONSchema> = {};
    const required = new Set<string>();
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
    const schema: JSONSchema | null =
        Object.keys(props).length > 0
            ? {
                  properties: props,
                  required: Array.from(required),
              }
            : null;
    return schema;
}
