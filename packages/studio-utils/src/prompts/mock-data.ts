import type { JSONSchema } from '@vertesia/common';

/**
 * Generate mock data that satisfies a JSON Schema.
 *
 * - string → `%property_name%` (visible placeholder, useful for previews and validation render tests)
 * - number/integer → random value 0–100
 * - boolean → true
 * - array → 1–2 items recursively generated from the items schema
 * - object → recursively populated from properties
 * - null → null
 * - $ref or unknown → `%property_name%`
 *
 * @param schema JSON schema to generate data for
 * @param propertyName Name used for string placeholders (default `value`)
 */
export function generateMockData(schema: JSONSchema, propertyName: string = 'value'): unknown {
    if ('$ref' in schema) {
        return `%${propertyName}%`;
    }

    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const primaryType = types[0];

    switch (primaryType) {
        case 'string':
            return `%${propertyName}%`;

        case 'number':
        case 'integer':
            return Math.floor(Math.random() * 101);

        case 'boolean':
            return true;

        case 'array': {
            const itemSchema = schema.items as JSONSchema;
            if (itemSchema) {
                const itemCount = Math.floor(Math.random() * 2) + 1;
                return Array.from({ length: itemCount }, (_, index) =>
                    generateMockData(itemSchema, `${propertyName}_${index}`),
                );
            }
            return [];
        }

        case 'object': {
            const result: Record<string, unknown> = {};
            if (schema.properties) {
                for (const [propName, propSchema] of Object.entries(schema.properties)) {
                    result[propName] = generateMockData(propSchema, propName);
                }
            }
            return result;
        }

        case 'null':
            return null;

        default:
            return `%${propertyName}%`;
    }
}
