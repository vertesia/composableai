import { describe, expect, it } from 'vitest';
import { ProcessRunConfigSchema } from './process.js';
import { ProcessAgentExecutionPolicySchema } from './process-agent-policy.js';

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

describe('ProcessAgentExecutionPolicySchema', () => {
    it('accepts cache-stable phase tool enforcement and retains a strict boundary', () => {
        expect(
            ProcessAgentExecutionPolicySchema.parse({
                phases: [
                    {
                        id: 'inspect',
                        tools: ['app_workspace_typecheck'],
                        continuation_tools: ['app_workspace_read'],
                        recovery_tools: ['app_workspace_read', 'app_workspace_edit'],
                        tool_input_contains: [
                            {
                                field: 'command',
                                contains: 'pnpm run test:unit',
                                not_contains: ['|'],
                                min_length: 18,
                            },
                        ],
                        max_tokens: 12_288,
                        recovery_prompt: 'Inspect source.',
                    },
                ],
                restrict_to_phase_tools: true,
                max_failed_tool_iterations: 3,
                max_failed_tool_iterations_per_phase: 2,
                max_repeated_tool_failure_iterations: 1,
            }),
        ).toMatchObject({
            phases: [
                {
                    tools: ['app_workspace_typecheck'],
                    continuation_tools: ['app_workspace_read'],
                    recovery_tools: ['app_workspace_read', 'app_workspace_edit'],
                    tool_input_contains: [
                        {
                            field: 'command',
                            contains: 'pnpm run test:unit',
                            not_contains: ['|'],
                            min_length: 18,
                        },
                    ],
                    max_tokens: 12_288,
                },
            ],
            restrict_to_phase_tools: true,
            max_failed_tool_iterations: 3,
            max_failed_tool_iterations_per_phase: 2,
            max_repeated_tool_failure_iterations: 1,
        });
        expect(() =>
            ProcessAgentExecutionPolicySchema.parse({
                phases: [{ id: 'inspect', tools: ['app_workspace_read'], recovery_prompt: 'Inspect source.' }],
                restrict_to_phase_tools: true,
                unexpected: true,
            }),
        ).toThrow();
        expect(() =>
            ProcessAgentExecutionPolicySchema.parse({
                phases: [
                    {
                        id: 'inspect',
                        tools: ['app_workspace_read'],
                        tool_input_contains: [{ field: 'path', contains: 'src/', not_contains: [], min_length: -1 }],
                        recovery_prompt: 'Inspect source.',
                    },
                ],
            }),
        ).toThrow();
        expect(() =>
            ProcessAgentExecutionPolicySchema.parse({
                phases: [{ id: 'inspect', tools: ['app_workspace_read'], recovery_prompt: 'Inspect source.' }],
                max_failed_tool_iterations_per_phase: 0,
                max_repeated_tool_failure_iterations: 0,
            }),
        ).toThrow();
    });
});
