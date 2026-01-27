import { JSONSchema } from "@llumiverse/common";

export default {
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
} satisfies JSONSchema;
