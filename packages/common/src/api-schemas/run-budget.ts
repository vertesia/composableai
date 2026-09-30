import { z } from 'zod';

export const RunBudgetOwnerSchema = z
    .strictObject({
        workflow_id: z.string().min(1),
        first_run_id: z.string().min(1),
    })
    .meta({ id: 'RunBudgetOwner' });

/** Cumulative counters are read from existing execution runs, never from an audit cursor. */
export const RunBudgetUsageSchema = z
    .strictObject({
        input: z.number().nonnegative(),
        cached_input: z.number().nonnegative(),
        output: z.number().nonnegative(),
    })
    .meta({ id: 'RunBudgetUsage' });

export const RunBudgetTotalsSchema = z
    .strictObject({
        measured: RunBudgetUsageSchema,
        unpriced: RunBudgetUsageSchema,
        reported_nano_usd: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        estimated_nano_usd: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        unmeasured_calls: z.number().int().nonnegative(),
        missing_usage_calls: z.number().int().nonnegative(),
    })
    .meta({ id: 'RunBudgetTotals' });

export const ReadRunBudgetUsagePayloadSchema = z
    .strictObject({
        account_id: z.string().min(1),
        project_id: z.string().min(1),
        agent_run_id: z.string().min(1),
        owner: RunBudgetOwnerSchema,
        require_estimates: z.boolean().optional(),
    })
    .meta({ id: 'ReadRunBudgetUsagePayload' });

export const RunBudgetCapabilitySchema = z
    .strictObject({
        supported: z.boolean(),
        source: z.enum(['provider', 'estimate', 'unavailable']),
        reason: z.string().optional(),
    })
    .meta({ id: 'RunBudgetCapability' });

export const RunBudgetCapabilityQuerySchema = z
    .strictObject({
        check_model: z
            .boolean()
            .optional()
            .meta({ description: 'False checks only whether estimates are enabled, without consulting model prices.' }),
        model: z.string().min(1),
        service_tier: z.string().optional(),
    })
    .meta({
        id: 'RunBudgetCapabilityQuery',
        description: 'Selected model and requested serving tier for run budget admission.',
    });
