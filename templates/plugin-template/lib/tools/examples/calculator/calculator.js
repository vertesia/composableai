function evaluateExpression(expr) {
    expr = expr.replace(/\s+/g, '');
    expr = expr.replace(/\^/g, '**');
    if (!/^[0-9+\-*/.()^]+$/.test(expr)) {
        throw new Error('Invalid expression. Only numbers and operators (+, -, *, /, ^) are allowed.');
    }
    try {
        const result = new Function(`'use strict'; return (${expr})`)();
        if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error('Result is not a valid number');
        }
        return result;
    }
    catch (error) {
        throw new Error(`Failed to evaluate expression: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
async function calculate(payload, _context) {
    try {
        const { expression } = payload.tool_use.tool_input;
        const result = evaluateExpression(expression);
        return {
            is_error: false,
            content: `Result: ${expression} = ${result}`
        };
    }
    catch (error) {
        return {
            is_error: true,
            content: `Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

export { calculate };
//# sourceMappingURL=calculator.js.map
