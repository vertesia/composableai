import type { JSONSchemaType } from "ajv"

/*Default JSON Schema type for rendition*/

export interface RenditionProperties {
    mime_type: string,
    source_etag?: string,
    height?: number,
    width?: number,
    multipart?: boolean,
    total_parts?: number,
}

export const RenditionSchema: JSONSchemaType<RenditionProperties> = {

    type: "object",
    description: "Represent a rendition of a file stored in an object. It will be stored as a separate object in the database.",
    properties: {
        mime_type: {
            type: "string",
            description: "The format of the rendition. This is a MIME type."
        },
        source_etag: {
            type: "string",
            description: "The ETag of the file used for the rendition.",
            nullable: true
        },
        height: {
            type: "integer",
            description: "The height of the rendition",
            nullable: true
        },
        width: {
            type: "integer",
            description: "The width of the rendition",
            nullable: true
        },
        multipart: {
            type: "boolean",
            description: "If the rendition is a multi-part rendition",
            nullable: true,
            default: false
        },
        total_parts: {
            type: "integer",
            description: "The total number of parts in the rendition",
            nullable: true
        }
    },
    required: ["mime_type"],
}



export interface DocumentPartProperties {

    source_etag?: string,
    part_number: number,
    title?: string,
    source_line_start?: number,
    source_line_end?: number,
    type?: 'text' | 'image' | 'table' | 'chart' | 'diagram' | 'code' | 'other',
    page_number?: number,
    description?: string,
    height?: number,
    width?: number,

}


export const DocumentPartSchema: JSONSchemaType<DocumentPartProperties> = {
    type: "object",
    description: "Represent a semantic chunk of a document",
    properties: {
        source_etag: {
            type: "string",
            description: "The ETag of the file used for the rendition.",
            nullable: true
        },
        part_number: {
            type: "integer",
            description: "The part number of the chunk",
        },
        title: {
            type: "string",
            description: "The title of the chunk",
            nullable: true
        },
        source_line_start: {
            type: "integer",
            description: "The line number where the chunk starts",
            nullable: true
        },
        source_line_end: {
            type: "integer",
            description: "The line number where the chunk ends",
            nullable: true
        },
        type: {
            type: "string",
            description: "The type of the chunk",
            enum: ['text', 'image', 'table', 'chart', 'diagram', 'code', 'other'],
            nullable: true
        },
        page_number: {
            type: "integer",
            description: "The page number of the document part",
            nullable: true
        },
        description: {
            type: "string",
            description: "The description of the document part, if it's an image, the exhaustive description of the image",
            nullable: true
        },
        height: {
            type: "integer",
            description: "The height of the rendition",
            nullable: true
        },
        width: {
            type: "integer",
            description: "The width of the rendition",
            nullable: true
        }
    },
    required: ["part_number"],
}
