import { ToolDefinition } from "@vertesia/tools-sdk";

export default {
    name: "weather",
    description: "Get the current weather for a given location.",
    input_schema: {
        type: "object",
        properties: {
            location: {
                type: "string",
                description: "The location to get the weather for, e.g., 'New York, NY'."
            }
        },
        required: ["location"]
    },
} satisfies ToolDefinition;
