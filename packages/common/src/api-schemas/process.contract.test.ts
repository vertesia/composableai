import { describe, expect, it } from 'vitest';
import { ProcessRunConfigSchema } from './process.js';

describe('ProcessRunConfigSchema', () => {
    it('accepts validated LLM execution configuration and retains a strict Process boundary', () => {
        expect(
            ProcessRunConfigSchema.parse({
                environment: 'openrouter-environment',
                model: 'openai/gpt-5.6-sol',
                model_options: { _option_id: 'openrouter-text', service_tier: 'flex' },
            }),
        ).toEqual({
            environment: 'openrouter-environment',
            model: 'openai/gpt-5.6-sol',
            model_options: { _option_id: 'openrouter-text', service_tier: 'flex' },
        });
        expect(() =>
            ProcessRunConfigSchema.parse({ environment: 'openrouter-environment', unexpected: true }),
        ).toThrow();
    });
});
