import { Tool } from "@vertesia/tools-sdk";
import { calculate } from "./calculator.js";
import { CalculatorParams, Schema } from "./schema.js";

export const CalculatorTool = {
    name: "calculator",
    description: "Performs basic mathematical calculations. Supports addition (+), subtraction (-), multiplication (*), division (/), and exponentiation (^).",
    input_schema: Schema,
    run: calculate
} satisfies Tool<CalculatorParams>;
