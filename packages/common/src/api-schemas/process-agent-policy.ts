import { z } from 'zod';

export const ProcessAgentToolPhaseSchema = z
    .strictObject({
        id: z.string().min(1),
        tools: z
            .array(z.string().min(1))
            .min(1)
            .meta({ description: 'Any successful tool in this list advances the phase.' }),
        min_successes: z
            .number()
            .int()
            .positive()
            .meta({ description: 'Successful matching calls required to advance. Defaults to one.' })
            .optional(),
        recovery_prompt: z.string().min(1).meta({
            description: 'Process-authored instruction used when the agent tries to finish during this phase.',
        }),
    })
    .meta({ id: 'ProcessAgentToolPhase' });

export const ProcessAgentExecutionPolicySchema = z
    .strictObject({
        phases: z
            .array(ProcessAgentToolPhaseSchema)
            .min(1)
            .meta({ description: 'Ordered successful-tool phases the agent node must complete.' }),
        defer_result_schema_until_complete: z
            .boolean()
            .meta({ description: 'Hide the node result schema from model calls until every declared phase completes.' })
            .optional(),
        action_phase_count: z
            .number()
            .int()
            .nonnegative()
            .meta({
                description:
                    'Number of leading phases whose model turns require a tool call. Defaults to zero and cannot exceed phases.length.',
            })
            .optional(),
        action_phase_max_tokens: z
            .number()
            .int()
            .positive()
            .meta({ description: 'Maximum output tokens while an action phase is active.' })
            .optional(),
        max_recovery_attempts_per_phase: z
            .number()
            .int()
            .nonnegative()
            .meta({ description: 'Bounded recovery turns allowed per incomplete phase. Defaults to one.' })
            .optional(),
    })
    .meta({ id: 'ProcessAgentExecutionPolicy' });
