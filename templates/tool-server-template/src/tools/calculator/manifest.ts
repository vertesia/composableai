import { ToolDefinition } from "@vertesia/tools-sdk";

export default {
    name: "calculator",
    description: "Performs basic mathematical calculations. Supports addition (+), subtraction (-), multiplication (*), division (/), and exponentiation (^).",
    input_schema: {
        type: "object",
        properties: {
            expression: {
                type: "string",
                description: "A mathematical expression to evaluate (e.g., '2 + 2', '10 * 5 - 3', '2^8')"
            }
        },
        required: ["expression"]
    }
} satisfies ToolDefinition;
