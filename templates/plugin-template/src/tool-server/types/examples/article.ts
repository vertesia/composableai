import { InCodeTypeDefinition, InCodeTypeSpec } from "@vertesia/common";

/**
 * Example content type: Article
 * A simple schema for article content with title and author
 */
export const ArticleType = {
    name: "article",
    description: "A simple article content type with title and author metadata",
    tags: ["content", "example", "article"],

    /**
     * JSON Schema defining the structure of an article
     */
    object_schema: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "The title of the article",
                minLength: 1,
                maxLength: 200
            },
            author: {
                type: "string",
                description: "The author of the article",
                minLength: 1,
                maxLength: 100
            }
        },
        required: ["title", "author"],
        additionalProperties: false
    },

    /**
     * Table layout for displaying articles in a list view
     */
    table_layout: [
        {
            field: "properties.title",
            name: "Title",
            type: "string"
        },
        {
            field: "properties.author",
            name: "Author",
            type: "string"
        }
    ],

    /**
     * Articles can be chunked for semantic search/RAG
     */
    is_chunkable: true,

    /**
     * Enforce strict validation against the schema
     */
    strict_mode: true
} satisfies InCodeTypeSpec;
