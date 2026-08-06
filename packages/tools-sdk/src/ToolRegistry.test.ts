import { describe, expect, it, vi } from 'vitest';
import type { Tool } from './types.js';
import { ToolRegistry } from './ToolRegistry.js';

function tool(name: string): Tool {
    return {
        name,
        description: name,
        input_schema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        run: vi.fn(async () => ({ is_error: false, content: name })),
    };
}

describe('ToolRegistry execution aliases', () => {
    it('executes a transitional alias without publishing it in definitions or tools', async () => {
        const published = tool('typed_update');
        const legacy = tool('legacy_update');
        const registry = new ToolRegistry('test', [published], [legacy]);

        expect(registry.getTools().map((entry) => entry.name)).toEqual(['typed_update']);
        expect(registry.getDefinitions().map((entry) => entry.name)).toEqual(['typed_update']);

        const result = await registry.runTool({
            tool_use: {
                id: 'call-legacy',
                tool_name: 'legacy_update',
                tool_input: {},
            },
            metadata: {},
        }, {} as never);

        expect(result).toEqual({ is_error: false, content: 'legacy_update' });
        expect(legacy.run).toHaveBeenCalledOnce();
    });

    it('rejects an alias that collides with a published tool', () => {
        expect(() => new ToolRegistry('test', [tool('same')], [tool('same')]))
            .toThrow('Duplicate tool or execution alias: same');
    });
});
