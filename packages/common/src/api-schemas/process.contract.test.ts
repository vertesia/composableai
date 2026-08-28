import { describe, expect, it } from 'vitest';
import { ProcessRunConfigSchema } from './process.js';

describe('ProcessRunConfigSchema', () => {
    it('accepts an execution environment and retains strict Process configuration', () => {
        expect(
            ProcessRunConfigSchema.parse({
                environment: 'openrouter-environment',
                model: 'openai/gpt-5.6-sol',
            }),
        ).toEqual({
            environment: 'openrouter-environment',
            model: 'openai/gpt-5.6-sol',
        });
        expect(() =>
            ProcessRunConfigSchema.parse({ environment: 'openrouter-environment', unexpected: true }),
        ).toThrow();
    });
});
