import { z } from 'zod';

export const AgentBudgetConfigurationSchema = z
    .strictObject({
        mode: z.enum(['token', 'dollar']).optional().meta({
            description: 'Run budget mode. An omitted mode preserves weighted-token budgeting.',
        }),
        limit_usd: z
            .number()
            .positive()
            .max(Number.MAX_SAFE_INTEGER / 1e9)
            .optional()
            .meta({
                description:
                    'Soft USD allowance for priced model calls; dollar mode also requires limit_tokens for unpriced calls.',
            }),
        reminder_at_remaining_fractions: z.array(z.number().positive().lt(1)).optional(),
        limit_tokens: z
            .number()
            .optional()
            .meta({
                description:
                    'Weighted token budget shared by the run and every subagent workstream it launches. When the ' +
                    'run and its workstreams together use this many weighted tokens, the agent gets one final ' +
                    'turn without tools to summarize its work, and the run ends. This is a soft limit, not a ' +
                    'spending cap: workstreams running concurrently and the final summary turns can go over ' +
                    'it. Unset or <=0 means no budget.',
            }),
        reminder_at_remaining_tokens: z
            .array(z.number())
            .optional()
            .meta({
                description:
                    'Remaining-budget thresholds, in weighted tokens, at which the agent is told how much budget ' +
                    'is left. Each threshold is delivered once per context window (again after a checkpoint). ' +
                    'Values outside (0, limit_tokens) are ignored. Unset means reminders at 25% and 10% remaining.',
            }),
        output_token_weight: z.number().min(0).optional().meta({
            description: 'Weight applied to output tokens, reasoning included, when charging the budget. Default 5.',
        }),
        input_token_weight: z.number().min(0).optional().meta({
            description: 'Weight applied to input tokens not read from the prompt cache. Default 1.',
        }),
        cached_input_token_weight: z
            .number()
            .min(0)
            .optional()
            .meta({
                description:
                    'Weight applied to input tokens read from the prompt cache. Default 0.1, so a long conversation ' +
                    'that mostly re-reads cached context is charged a tenth of the uncached rate for it.',
            }),
    })
    .meta({
        id: 'AgentBudgetConfiguration',
        description:
            'Weighted token budget for an agent run and its subagent workstreams. A call is charged ' +
            'output × output_token_weight + uncached input × input_token_weight + cached input × ' +
            'cached_input_token_weight.',
    });
