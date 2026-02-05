var result_schema = {
    type: "object",
    properties: {
        color: {
            type: "string",
            description: "The identified color of the object"
        },
        object: {
            type: "string",
            description: "The object whose color was identified"
        }
    },
    required: ["color", "object"]
};

export { result_schema as default };
//# sourceMappingURL=result_schema.js.map
