export type TsPropType = "string" | "number" | "boolean" | "record" | "object" | "array" | "enum" | "literal" | "union" | "promise" | "any";

// generic types are replaced by "any"
export interface ActivityTypeDefinition {
    name: TsPropType;
    // in case of primitives will be the type name: string, boolean number.
    // in case of objects or enums will be the object name
    // in case of arrays will be String(itemType.value)+"[]"
    // in case of primitive literals will be the value
    // or nested objects / arrays will be "object" or "array"
    // for record this is Record<type,type>
    value: string | boolean | number;
    // in case of objects
    members?: ActivityPropertyDefinition[];
    // in case of arrays or promises will be innertype (i.e. the element type for arrays)
    innerType?: ActivityTypeDefinition;
    // in case of enums the enum values will be here
    enum?: string[] | number[] | undefined;
    // in case of unions
    union?: ActivityTypeDefinition[];
}

export interface ActivityPropertyDefinition {
    name: string;
    type: ActivityTypeDefinition;
    optional: boolean;
    // the JSDoc comment for the activity property
    doc?: string;
}

export interface ActivityDefinition {
    name: string;
    // generated from name
    title: string;
    description?: string;
    // the JSDoc comment for the activity function
    doc?: string;
    paramsType: string;
    params: ActivityPropertyDefinition[];
    returnType?: ActivityTypeDefinition | undefined;
}

export interface ActivityCatalog {
    activities: ActivityDefinition[];
}
