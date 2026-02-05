import { calculate } from "./calculator.js";
export declare const CalculatorTool: {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: {
            expression: {
                type: "string";
                description: string;
            };
        };
        required: string[];
    };
    run: typeof calculate;
};
//# sourceMappingURL=index.d.ts.map