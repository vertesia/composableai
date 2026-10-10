import type { ToolResultContent } from '@vertesia/common';
import type { ToolExecutionContext, ToolExecutionPayload } from '@vertesia/tools-sdk';
import type { CalculatorParams } from './schema.js';

/**
 * Safely evaluates a mathematical expression
 * Supports: +, -, *, /, ^, parentheses, and decimal numbers
 */
function evaluateExpression(expr: string): number {
    expr = expr.replace(/\s+/g, '');
    if (!expr || expr.length > 1024 || !/^[0-9+\-*/.()^]+$/.test(expr))
        throw new Error('Invalid expression. Only numbers and operators (+, -, *, /, ^) are allowed.');
    let index = 0;
    let depth = 0;
    const primary = (): number => {
        if (expr[index] === '(') {
            index++;
            const value = sum();
            if (expr[index++] !== ')') throw new Error('Unclosed parentheses');
            return value;
        }
        const number = /^(?:\d+\.?\d*|\.\d+)/.exec(expr.slice(index));
        if (!number) throw new Error('Expected a number');
        index += number[0].length;
        return Number(number[0]);
    };
    const power = (): number => {
        const value = primary();
        if (expr[index] === '^' || expr.slice(index, index + 2) === '**') {
            index += expr[index] === '^' ? 1 : 2;
            return value ** unary();
        }
        return value;
    };
    const unary = (): number => {
        if (++depth > 64) throw new Error('Expression is too deeply nested');
        try {
            if (expr[index] === '+' || expr[index] === '-') {
                const negative = expr[index++] === '-';
                return (negative ? -1 : 1) * unary();
            }
            return power();
        } finally {
            depth--;
        }
    };
    const product = (): number => {
        let value = unary();
        while (expr[index] === '*' || expr[index] === '/') {
            const operation = expr[index++];
            const right = unary();
            value = operation === '*' ? value * right : value / right;
        }
        return value;
    };
    const sum = (): number => {
        let value = product();
        while (expr[index] === '+' || expr[index] === '-') {
            const operation = expr[index++];
            const right = product();
            value = operation === '+' ? value + right : value - right;
        }
        return value;
    };
    const result = sum();
    if (index !== expr.length || !Number.isFinite(result)) throw new Error('Result is not a valid number');
    return result;
}

export async function calculate(
    payload: ToolExecutionPayload<CalculatorParams>,
    _context: ToolExecutionContext,
): Promise<ToolResultContent> {
    try {
        const input = payload.tool_use.tool_input;
        if (!input) {
            throw new Error('Missing calculator input');
        }
        const { expression } = input;
        const result = evaluateExpression(expression);

        return {
            is_error: false,
            content: `Result: ${expression} = ${result}`,
        } satisfies ToolResultContent;
    } catch (error) {
        return {
            is_error: true,
            content: `Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        } satisfies ToolResultContent;
    }
}
