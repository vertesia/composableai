import { expect, it } from 'vitest';
import { createApiContract } from './engine.js';

it('keeps validator caches and schemas isolated between registries', () => {
    const numeric = createApiContract<{ Value: number }>({ Value: { type: 'number' } });
    const text = createApiContract<{ Value: string }>({ Value: { type: 'string' } });
    expect(numeric.validateApiRequest('Value', 1)).toEqual({ valid: true, data: 1 });
    expect(text.validateApiRequest('Value', 'one')).toEqual({ valid: true, data: 'one' });
    expect(numeric.validateApiRequest('Value', 'one').valid).toBe(false);
    expect(text.validateApiRequest('Value', 1).valid).toBe(false);
});
