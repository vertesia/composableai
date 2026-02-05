const ArticleType = {
    name: "article",
    description: "A simple article content type with title and author metadata",
    tags: ["content", "example", "article"],
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
    is_chunkable: true,
    strict_mode: true
};

export { ArticleType };
//# sourceMappingURL=article.js.map
