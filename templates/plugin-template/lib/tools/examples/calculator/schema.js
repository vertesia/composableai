const Schema = {
    type: "object",
    properties: {
        expression: {
            type: "string",
            description: "A mathematical expression to evaluate (e.g., '2 + 2', '10 * 5 - 3', '2^8')"
        }
    },
    required: ["expression"]
};

export { Schema };
//# sourceMappingURL=schema.js.map
