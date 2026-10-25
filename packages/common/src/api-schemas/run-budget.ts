import { z } from 'zod';

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
