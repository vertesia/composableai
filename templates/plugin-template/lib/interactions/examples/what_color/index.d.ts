declare const _default: {
    name: string;
    title: string;
    description: string;
    result_schema: {
        type: "object";
        properties: {
            color: {
                type: "string";
                description: string;
            };
            object: {
                type: "string";
                description: string;
            };
        };
        required: string[];
    };
    prompts: {
        content_type: import("@vertesia/common").TemplateType;
        content: string;
        role: import("@llumiverse/common").PromptRole;
        schema?: any;
        name?: string | undefined;
        externalId?: string | undefined;
    }[];
    tags: string[];
};
export default _default;
//# sourceMappingURL=index.d.ts.map