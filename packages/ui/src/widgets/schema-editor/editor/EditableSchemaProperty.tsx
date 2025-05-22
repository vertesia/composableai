import { SchemaNode } from "../ManagedSchema.js";

export interface EditableSchemaProperty {
    name: string;
    type: string;
    description?: string;
}

export function getEditableSchemaProperty(schema: SchemaNode): EditableSchemaProperty {
    return {
        name: schema.getNameSignature(),
        type: schema.getTypeSignature(),
        description: schema.description
    }
}