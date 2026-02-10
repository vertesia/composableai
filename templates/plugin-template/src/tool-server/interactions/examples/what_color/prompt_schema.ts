import { JSONSchema } from "@llumiverse/common";

export default {
    type: "object",
    properties: {
        object: {
            type: "string",
            description: "The object to identify the color of"
        },
    },
    required: ["object"]
} satisfies JSONSchema;
