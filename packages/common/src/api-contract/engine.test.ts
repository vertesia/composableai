import { afterEach, expect, it, vi } from 'vitest';
import { createApiContract } from './engine.js';

it('keeps validator caches and schemas isolated between registries', () => {
    const numeric = createApiContract<{ Value: number }>({ Value: { type: 'number' } });
    const text = createApiContract<{ Value: string }>({ Value: { type: 'string' } });
    expect(numeric.validateApiRequest('Value', 1)).toEqual({ valid: true, data: 1 });
    expect(text.validateApiRequest('Value', 'one')).toEqual({ valid: true, data: 'one' });
    expect(numeric.validateApiRequest('Value', 'one').valid).toBe(false);
    expect(text.validateApiRequest('Value', 1).valid).toBe(false);
});

afterEach(() => {
    vi.restoreAllMocks();
});

it('compiles the starts_with format without logging and still enforces its pattern', () => {
    const warn = vi.spyOn(console, 'warn');
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    // The shape Zod's `.startsWith('sk-')` produces: the format is an annotation, the pattern checks the prefix.
    const contract = createApiContract<{ Key: string }>({
        Key: { type: 'string', format: 'starts_with', pattern: '^sk-' },
    });

    expect(contract.validateApiRequest('Key', 'sk-123')).toEqual({ valid: true, data: 'sk-123' });
    expect(contract.validateApiRequest('Key', 'pk-123').valid).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
});
