import type { JSONSchema, JSONSchemaTypeName } from "@vertesia/common";
import { TypeNames, TypeSignature } from "./type-signature.js";


export function setPropertyName(schema: JSONSchema, name: string, newName: string) {
    if (schema.properties) {
        const properties = schema.properties;
        const newProperties = {} as Record<string, JSONSchema>;
        for (const key of Object.keys(properties)) {
            const value = properties[key];
            if (key === name) {
                newProperties[newName] = value;
            } else {
                newProperties[key] = value;
            }
        }
        schema.properties = newProperties;
    }
    if (schema.required) {
        schema.required = (schema.required as string[]).map(x => x === name ? newName : x);
    }
}

export function setRequireProperty(schema: JSONSchema, name: string, isRequired: boolean) {
    if (Array.isArray(schema.required)) {
        const index = schema.required.indexOf(name);
        if (isRequired) {
            if (index < 0) {
                schema.required.push(name);
            }
        } else {
            if (index > -1) {
                schema.required.splice(index, 1);
            }
        }
    } else if (isRequired) {
        schema.required = [name];
    }
}

export function setPropertyType(schema: JSONSchema, type: TypeSignature) {
    const isAny = type.name === "any";
    let typeObj: JSONSchemaTypeName | JSONSchemaTypeName[] | undefined = isAny ?
        undefined
        : (type.isNullable ?
            [type.name, "null"] as JSONSchemaTypeName[]
            : type.name as JSONSchemaTypeName);
    if (type.isArray) {
        schema.type = "array";
        schema.properties = undefined;
        if (!schema.items || Array.isArray(schema.items)) {
            schema.items = {
                type: typeObj,
                properties: type.isObject ? {} : undefined
            }
        } else {
            const items = schema.items as JSONSchema;
            items.type = typeObj;
            if (type.isObject && !items.properties) {
                items.properties = {};
            }
        }
    } else {
        schema.type = typeObj;
        schema.items = undefined;
        if (type.isObject) {
            if (!schema.properties) {
                schema.properties = {};
            }
        } else {
            schema.properties = undefined;
        }
    }
}

export function removeProperty(schema: JSONSchema, name: string) {
    if (schema.properties) {
        delete schema.properties[name];
        if (Array.isArray(schema.required)) {
            schema.required = schema.required.filter(x => x !== name);
        }
    }
}

/**
 * Create a new property in the schema
 * @param schema
 * @param name
 * @param type
 * @param isRequired
 */
export function addProperty(schema: JSONSchema, name: string, type: TypeSignature, isRequired = false) {
    if (schema.type !== "object") {
        throw new Error("Cannot add property to a non-object schema");
    }
    if (!schema.properties) {
        schema.properties = {};
    }
    const newSchema = {} as JSONSchema;
    setPropertyType(newSchema, type);
    schema.properties[name] = newSchema;
    if (isRequired) {
        if (Array.isArray(schema.required)) {
            addRequired(schema.required, name);
        } else {
            schema.required = [name];
        }
    }
    return newSchema;
}

export function getTypeSignature(schema: JSONSchema): TypeSignature {
    let isNullable = false, isArray = false;
    let typeName: JSONSchemaTypeName | undefined;
    const type = schema.type;
    if (Array.isArray(type)) {
        for (const t of type) {
            if (t === "null") {
                isNullable = true;
            } else if (!typeName) {
                typeName = t;
            }
        }
    } else {
        typeName = type;
    }
    if (!typeName) {
        typeName = "any";
    }
    if (typeName === 'array') {
        isArray = true;
        typeName = getItemTypeName(schema.items);
    }
    let displayTypeName: string = typeName;
    switch (schema.editor || schema.format) {
        case 'textarea': {
            displayTypeName = 'text'; break;
        }
        case 'media': {
            displayTypeName = 'media'; break;
        }
        case 'document': {
            displayTypeName = 'document'; break;
        }
    }
    return {
        isNullable,
        isArray,
        isObject: typeName === "object",
        name: displayTypeName as TypeNames
    }
}

// TODO we don't support array of arrays
// for array of multiple type we get the first type
function getItemTypeName(schema: JSONSchema | JSONSchema[] | undefined) {
    if (!schema) {
        return "any"
    }
    let name: JSONSchemaTypeName;
    if (Array.isArray(schema)) {
        name = getFirstNotNullType(schema[0].type)
    } else {
        name = getFirstNotNullType(schema.type)
    }
    if (name === "array" || name === "null") {
        name = "any";
    }
    return name;
}

function getFirstNotNullType(type: JSONSchemaTypeName | JSONSchemaTypeName[] | undefined) {
    if (!type) {
        return "any";
    }
    if (Array.isArray(type)) {
        return type.find(x => x !== "null") || "any";
    }
    return type;
}


function addRequired(required: string[], name: string) {
    if (!required.includes(name)) {
        required.push(name);
    }
}