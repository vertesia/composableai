import { z } from 'zod';

export const ProcessAgentToolInputContainsSchema = z
    .strictObject({
        field: z.string().min(1).meta({ description: 'Top-level tool-input field to inspect.' }),
        contains: z.string().min(1).meta({ description: 'Case-sensitive substring required in the string field.' }),
        not_contains: z
            .array(z.string().min(1))
            .min(1)
            .meta({ description: 'Case-sensitive substrings forbidden in the same string field.' })
            .optional(),
        min_length: z
            .number()
            .int()
            .nonnegative()
            .meta({ description: 'Minimum string length required for the same field.' })
            .optional(),
    })
    .meta({ id: 'ProcessAgentToolInputContains' });

export const ProcessAgentToolPhaseSchema = z
    .strictObject({
        id: z.string().min(1),
        tools: z
            .array(z.string().min(1))
            .min(1)
            .meta({ description: 'Any successful tool in this list advances the phase.' }),
        continuation_tools: z
            .array(z.string().min(1))
            .min(1)
            .meta({
                description:
                    'Additional tools authorized while the phase is active. Successful calls do not advance the phase.',
            })
            .optional(),
        recovery_tools: z
            .array(z.string().min(1))
            .min(1)
            .meta({
                description:
                    'Additional tools authorized only after a matching phase tool fails. Successful calls do not advance the phase.',
            })
            .optional(),
        tool_input_contains: z
            .array(ProcessAgentToolInputContainsSchema)
            .min(1)
            .meta({
                description:
                    'All declared top-level string-field presence, absence, and minimum-length checks must match before a tool call is authorized or advances the phase.',
            })
            .optional(),
        min_successes: z
            .number()
            .int()
            .positive()
            .meta({ description: 'Successful matching calls required to advance. Defaults to one.' })
            .optional(),
        max_tokens: z
            .number()
            .int()
            .positive()
            .meta({ description: 'Optional output-token ceiling for model turns while this action phase is active.' })
            .optional(),
        recovery_prompt: z.string().min(1).meta({
            description: 'Process-authored instruction used when the agent tries to finish during this phase.',
        }),
    })
    .meta({ id: 'ProcessAgentToolPhase' });

export const ProcessAgentPhaseResetSchema = z
    .strictObject({
        tools: z
            .array(z.string().min(1))
            .min(1)
            .meta({ description: 'Successful tools that invalidate later phase progress.' }),
        tool_input_contains: z
            .array(ProcessAgentToolInputContainsSchema)
            .min(1)
            .meta({ description: 'Optional input checks applied to the invalidating tool call.' })
            .optional(),
        to_phase: z.string().min(1).meta({ description: 'Phase id that must be completed next after invalidation.' }),
    })
    .meta({ id: 'ProcessAgentPhaseReset' });

export const ProcessAgentExecutionPolicySchema = z
    .strictObject({
        phases: z
            .array(ProcessAgentToolPhaseSchema)
            .min(1)
            .meta({ description: 'Ordered successful-tool phases the agent node must complete.' }),
        phase_resets: z
            .array(ProcessAgentPhaseResetSchema)
            .min(1)
            .meta({
                description:
                    'Successful tool calls that invalidate prior progress and reset execution to a declared phase.',
            })
            .optional(),
        defer_result_schema_until_complete: z
            .boolean()
            .meta({ description: 'Hide the node result schema from model calls until every declared phase completes.' })
            .optional(),
        restrict_to_phase_tools: z
            .boolean()
            .meta({
                description:
                    'Expose one stable union of declared phase tools to the model, and reject tool calls that do not satisfy the current phase. This preserves prompt-cache stability while enforcing ordered execution.',
            })
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
        max_failed_tool_iterations: z
            .number()
            .int()
            .positive()
            .meta({
                description:
                    'Run-wide budget of repeated model iterations containing failed tool results before the agent node stops. The first failing iteration establishes model-visible recovery evidence and is not charged; phase transitions do not reset the budget. Defaults to eight.',
            })
            .optional(),
        max_failed_tool_iterations_per_phase: z
            .number()
            .int()
            .positive()
            .meta({
                description:
                    'Optional per-phase budget of corrective model iterations that still contain failed tool results. The first failure in each phase establishes recovery evidence and is not charged.',
            })
            .optional(),
        max_repeated_tool_failure_iterations: z
            .number()
            .int()
            .positive()
            .meta({
                description:
                    'Optional number of repeated normalized failure fingerprints allowed in one phase before the agent node stops. A value of one stops after the first corrective iteration repeats an already observed cause.',
            })
            .optional(),
        completion_prompt: z
            .string()
            .min(1)
            .meta({
                description:
                    'Process-authored instruction appended to the final successful tool result. That turn restores the result schema and requires the agent to return its result without another tool call.',
            })
            .optional(),
    })
    .meta({ id: 'ProcessAgentExecutionPolicy' });
