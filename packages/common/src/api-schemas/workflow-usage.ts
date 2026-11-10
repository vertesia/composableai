import { z } from 'zod';
export const WorkflowUsageQuerySchema = z
    .strictObject({ workflow_class: z.string().min(1).max(256).optional() })
    .meta({ id: 'WorkflowUsageQuery' });
export const WorkflowUsageClassSchema = z
    .strictObject({
        workflow_class: z.string(),
        strategy: z.enum(['rate', 'concurrency']),
        mode: z.enum(['active', 'dry-run', 'disabled']),
        available: z.boolean(),
        observed_at: z.string().datetime().nullable(),
        freshness: z.enum(['fresh', 'stale', 'unavailable']),
        start_window: z
            .strictObject({
                limit: z.number().nonnegative(),
                window_ms: z.number().positive(),
                used: z.number().nonnegative().nullable(),
            })
            .nullable(),
        occupancy: z
            .strictObject({
                limit: z.number().nonnegative().nullable(),
                tenant_limit: z.number().nonnegative(),
                active: z.number().nonnegative().nullable(),
                tenant_active: z.number().nonnegative().nullable(),
            })
            .nullable(),
        backlog: z.strictObject({
            pending: z.number().nonnegative().nullable(),
            deferred: z.number().nonnegative().nullable(),
            oldest_deferred_at: z.string().datetime().nullable(),
        }),
        actual_starts: z.strictObject({ count: z.number().nonnegative().nullable(), window_ms: z.number().positive() }),
    })
    .meta({ id: 'WorkflowUsageClass' });
export const WorkflowUsageStandingSchema = z
    .strictObject({
        tenant_id: z.string(),
        available: z.boolean(),
        start_governance_enabled: z.boolean(),
        truncated: z.boolean(),
        classes: z.array(WorkflowUsageClassSchema),
    })
    .meta({ id: 'WorkflowUsageStanding' });
