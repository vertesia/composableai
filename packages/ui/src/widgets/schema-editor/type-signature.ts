
export enum TypeNames {
    string = "string",
    number = "number",
    integer = "integer",
    boolean = "boolean",
    object = "object",
    any = "any",
    text = "text", // a string with an additional editor: textarea property
    media = "media", // a media file ref
    document = "document", // a document ref
    enum = "enum", // a string with enum constraint
}


export interface TypeSignature {
    name: TypeNames,
    isObject: boolean,
    isNullable: boolean,
    isArray: boolean,
}


export function parseTypeSignature(text: string): TypeSignature {
    text = text.trim();
    let isArray = false, isNullable = false;
    if (text.endsWith('?')) {
        isNullable = true;
        text = text.substring(0, text.length - 1).trim();
    }
    if (text.endsWith('[]')) {
        isArray = true;
        text = text.substring(0, text.length - 2).trim();
    }
    const name = TypeNames[text as TypeNames]
    if (!name) {
        throw new Error(`Unknown type "${text}"`);
    }
    return { name, isArray, isNullable, isObject: name === TypeNames.object };
}
