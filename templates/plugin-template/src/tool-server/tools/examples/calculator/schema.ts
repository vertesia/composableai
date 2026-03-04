import { JSONSchema } from "@llumiverse/common";

export interface CalculatorParams {
    expression: string;
}

export const Schema = {
    type: "object",
    properties: {
        expression: {
            type: "string",
            description: "A mathematical expression to evaluate (e.g., '2 + 2', '10 * 5 - 3', '2^8')"
        }
    },
    required: ["expression"]
} satisfies JSONSchema;
