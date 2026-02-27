import { Tool, ToolExecutionContext, ToolExecutionPayload } from "@vertesia/tools-sdk";
import { type CalculatorParams } from "./schema.js";
import { ToolResultContent } from "@vertesia/common";


/**
 * Safely evaluates a mathematical expression
 * Supports: +, -, *, /, ^, parentheses, and decimal numbers
 */
function evaluateExpression(expr: string): number {
    // Remove whitespace
    expr = expr.replace(/\s+/g, '');

    // Replace ^ with ** for exponentiation
    expr = expr.replace(/\^/g, '**');

    // Validate expression - only allow numbers, operators, parentheses, and decimal points
    if (!/^[0-9+\-*/.()^]+$/.test(expr)) {
        throw new Error('Invalid expression. Only numbers and operators (+, -, *, /, ^) are allowed.');
    }

    // Use Function constructor for safe evaluation (better than eval)
    try {
        const result = new Function(`'use strict'; return (${expr})`)();
        if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error('Result is not a valid number');
        }
        return result;
    } catch (error) {
        throw new Error(`Failed to evaluate expression: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
    }
}

export async function calculate(
    payload: ToolExecutionPayload<CalculatorParams>,
    _context: ToolExecutionContext
): Promise<ToolResultContent> {
    try {
        const { expression } = payload.tool_use.tool_input!;
        const result = evaluateExpression(expression);

        return {
            is_error: false,
            content: `Result: ${expression} = ${result}`
        } satisfies ToolResultContent;
    } catch (error) {
        return {
            is_error: true,
            content: `Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        } satisfies ToolResultContent;
    }
}
