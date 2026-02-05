import { calculate } from './calculator.js';
import { Schema } from './schema.js';

const CalculatorTool = {
    name: "calculator",
    description: "Performs basic mathematical calculations. Supports addition (+), subtraction (-), multiplication (*), division (/), and exponentiation (^).",
    input_schema: Schema,
    run: calculate
};

export { CalculatorTool };
//# sourceMappingURL=index.js.map
