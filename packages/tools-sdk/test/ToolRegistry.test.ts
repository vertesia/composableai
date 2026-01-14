import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, ToolNotFoundError, ToolInputValidationError } from '../src/ToolRegistry.js';
import type { Tool, ToolExecutionPayload, ToolExecutionContext } from '../src/types.js';

// Helper to create a mock tool with schema
function createMockTool<T extends Record<string, unknown>>(
    name: string,
    inputSchema: Record<string, unknown>,
    handler?: (payload: ToolExecutionPayload<T>, context: ToolExecutionContext) => Promise<{ is_error: boolean; content: string }>
): Tool<T> {
    return {
        name,
        description: `Test tool: ${name}`,
        input_schema: inputSchema,
        run: handler || (async () => ({ is_error: false, content: 'OK' })),
    };
}

// Helper to create execution payload
function createPayload<T>(toolName: string, input: T): ToolExecutionPayload<T> {
    return {
        tool_use: {
            id: 'test-id',
            tool_name: toolName,
            tool_input: input,
        },
        metadata: {},
    };
}

// Mock execution context
const mockContext: ToolExecutionContext = {
    account: { id: 'test-account' },
    project: { id: 'test-project' },
};

describe('ToolRegistry', () => {
    describe('input validation', () => {
        it('should pass validation for valid input', async () => {
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    count: { type: 'number' },
                },
                required: ['name'],
                additionalProperties: false,
            });

            const registry = new ToolRegistry([tool]);
            const payload = createPayload('test_tool', { name: 'test', count: 5 });

            const result = await registry.runTool(payload, mockContext);
            expect(result.is_error).toBe(false);
            expect(result.content).toBe('OK');
        });

        it('should fail validation for missing required field', async () => {
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    count: { type: 'number' },
                },
                required: ['name'],
                additionalProperties: false,
            });

            const registry = new ToolRegistry([tool]);
            const payload = createPayload('test_tool', { count: 5 }); // missing 'name'

            try {
                await registry.runTool(payload, mockContext);
                expect.fail('Should have thrown ToolInputValidationError');
            } catch (err) {
                expect(err).toBeInstanceOf(ToolInputValidationError);
                expect((err as Error).message).toContain('name');
            }
        });

        it('should fail validation for wrong type', async () => {
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    count: { type: 'number' },
                },
                required: ['count'],
                additionalProperties: false,
            });

            const registry = new ToolRegistry([tool]);
            const payload = createPayload('test_tool', { count: 'not-a-number' });

            // Note: with coerceTypes: true, "5" would be coerced to 5
            // but "not-a-number" cannot be coerced
            try {
                await registry.runTool(payload, mockContext);
                expect.fail('Should have thrown ToolInputValidationError');
            } catch (err) {
                expect(err).toBeInstanceOf(ToolInputValidationError);
                expect((err as Error).message).toContain('count');
            }
        });

        it('should coerce string to number when possible', async () => {
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    count: { type: 'number' },
                },
                required: ['count'],
                additionalProperties: false,
            });

            const registry = new ToolRegistry([tool]);
            const payload = createPayload('test_tool', { count: '42' }); // string that can be coerced

            const result = await registry.runTool(payload, mockContext);
            expect(result.is_error).toBe(false);
        });

        it('should apply default values from schema', async () => {
            let receivedInput: unknown;
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    limit: { type: 'number', default: 100 },
                },
                required: ['name'],
                additionalProperties: false,
            }, async (payload) => {
                receivedInput = payload.tool_use.tool_input;
                return { is_error: false, content: 'OK' };
            });

            const registry = new ToolRegistry([tool]);
            const payload = createPayload('test_tool', { name: 'test' }); // no limit provided

            await registry.runTool(payload, mockContext);
            expect((receivedInput as { limit: number }).limit).toBe(100);
        });

        it('should remove additional properties not in schema', async () => {
            let receivedInput: unknown;
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                },
                required: ['name'],
                additionalProperties: false,
            }, async (payload) => {
                receivedInput = payload.tool_use.tool_input;
                return { is_error: false, content: 'OK' };
            });

            const registry = new ToolRegistry([tool]);
            const payload = createPayload('test_tool', { name: 'test', extraField: 'should be removed' });

            await registry.runTool(payload, mockContext);
            expect(receivedInput).toEqual({ name: 'test' });
            expect((receivedInput as Record<string, unknown>).extraField).toBeUndefined();
        });

        it('should validate enum values', async () => {
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['ACTIVE', 'INACTIVE', 'PENDING'],
                    },
                },
                required: ['status'],
                additionalProperties: false,
            });

            const registry = new ToolRegistry([tool]);

            // Valid enum value
            const validPayload = createPayload('test_tool', { status: 'ACTIVE' });
            const result = await registry.runTool(validPayload, mockContext);
            expect(result.is_error).toBe(false);

            // Invalid enum value
            const invalidPayload = createPayload('test_tool', { status: 'INVALID' });
            try {
                await registry.runTool(invalidPayload, mockContext);
                expect.fail('Should have thrown ToolInputValidationError');
            } catch (err) {
                expect(err).toBeInstanceOf(ToolInputValidationError);
                expect((err as Error).message).toContain('status');
            }
        });

        it('should validate nested objects', async () => {
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    user: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            age: { type: 'number' },
                        },
                        required: ['name'],
                        additionalProperties: false,
                    },
                },
                required: ['user'],
                additionalProperties: false,
            });

            const registry = new ToolRegistry([tool]);

            // Valid nested object
            const validPayload = createPayload('test_tool', { user: { name: 'John', age: 30 } });
            const result = await registry.runTool(validPayload, mockContext);
            expect(result.is_error).toBe(false);

            // Missing required nested field
            const invalidPayload = createPayload('test_tool', { user: { age: 30 } });
            try {
                await registry.runTool(invalidPayload, mockContext);
                expect.fail('Should have thrown ToolInputValidationError');
            } catch (err) {
                expect(err).toBeInstanceOf(ToolInputValidationError);
                expect((err as Error).message).toContain('user');
            }
        });

        it('should validate arrays', async () => {
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: { type: 'string' },
                        minItems: 1,
                    },
                },
                required: ['items'],
                additionalProperties: false,
            });

            const registry = new ToolRegistry([tool]);

            // Valid array
            const validPayload = createPayload('test_tool', { items: ['a', 'b', 'c'] });
            const result = await registry.runTool(validPayload, mockContext);
            expect(result.is_error).toBe(false);

            // Empty array (minItems: 1)
            const emptyPayload = createPayload('test_tool', { items: [] });
            try {
                await registry.runTool(emptyPayload, mockContext);
                expect.fail('Should have thrown ToolInputValidationError');
            } catch (err) {
                expect(err).toBeInstanceOf(ToolInputValidationError);
                expect((err as Error).message).toContain('items');
            }
        });

        it('should include field path in error message', async () => {
            const tool = createMockTool('test_tool', {
                type: 'object',
                properties: {
                    user: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                        },
                        required: ['name'],
                    },
                },
                required: ['user'],
            });

            const registry = new ToolRegistry([tool]);
            const payload = createPayload('test_tool', { user: {} }); // missing name

            try {
                await registry.runTool(payload, mockContext);
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(ToolInputValidationError);
                expect((err as Error).message).toContain('/user');
            }
        });
    });

    describe('tool not found', () => {
        it('should throw ToolNotFoundError for unknown tool', async () => {
            const registry = new ToolRegistry([]);
            const payload = createPayload('unknown_tool', {});

            try {
                await registry.runTool(payload, mockContext);
                expect.fail('Should have thrown ToolNotFoundError');
            } catch (err) {
                expect(err).toBeInstanceOf(ToolNotFoundError);
                expect((err as Error).message).toContain('unknown_tool');
            }
        });
    });

    describe('registerTool', () => {
        it('should validate input for dynamically registered tools', async () => {
            const registry = new ToolRegistry([]);

            const tool = createMockTool('dynamic_tool', {
                type: 'object',
                properties: {
                    value: { type: 'number' },
                },
                required: ['value'],
                additionalProperties: false,
            });

            registry.registerTool(tool);

            // Valid input
            const validPayload = createPayload('dynamic_tool', { value: 42 });
            const result = await registry.runTool(validPayload, mockContext);
            expect(result.is_error).toBe(false);

            // Invalid input
            const invalidPayload = createPayload('dynamic_tool', { value: 'not-a-number' });
            try {
                await registry.runTool(invalidPayload, mockContext);
                expect.fail('Should have thrown ToolInputValidationError');
            } catch (err) {
                expect(err).toBeInstanceOf(ToolInputValidationError);
                expect((err as Error).message).toContain('value');
            }
        });
    });
});
