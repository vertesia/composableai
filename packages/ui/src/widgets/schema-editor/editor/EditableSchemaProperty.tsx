import type { SchemaNode } from '../ManagedSchema.js';

export interface EditableSchemaProperty {
    name: string;
    type: string;
    description?: string;
    /** When false, field is excluded from model extraction (`x-extract: false`). Default true. */
    extractable?: boolean;
}

export function getEditableSchemaProperty(schema: SchemaNode): EditableSchemaProperty {
    return {
        name: schema.getNameSignature(),
        type: schema.getTypeSignature(),
        description: schema.description,
        extractable: schema.extractable,
    };
}
