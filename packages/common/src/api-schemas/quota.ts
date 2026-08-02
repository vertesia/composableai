import { z } from 'zod';

/**
 * Runtime API schemas for quota standing and tier endpoints.
 */

/**
 * Note the `id`: this is a hoisted component in the document, not an inline string. `z.string()` alone
 * would inline it at every use site and change three published schemas.
 */
export const QuotaEffectiveTierSchema = z.string().meta({
    id: 'QuotaEffectiveTier',
    description:
        'Effective quota tier name after account-level overrides and account-type derivation. ' +
        'Code-defined tier names are currently `QuotaTier`, but this remains a string because deployments ' +
        'can introduce quota tiers through configuration.',
});

/**
 * Descriptions go in `.meta()`, not in TSDoc comments.
 *
 * Zod does not read comments, so public descriptions belong in schema metadata.
 */
export const QuotaStandingWindowSchema = z
    .object({
        limit: z.number().meta({
            description: 'Effective limit for this window (after effective account tier + per-tenant override).',
        }),
        used: z.number().meta({ description: 'Requests used in the current window.' }),
        remaining: z.number().meta({ description: 'Requests remaining (max(0, limit - used)).' }),
        window_ms: z.number(),
    })
    .meta({
        id: 'QuotaStandingWindow',
        description:
            'A caller\'s own quota standing (GET /api/v1/quota/standing) — "where am I". API rate limits are ' +
            'genuinely per-tenant; workflow admission and the LLM limiter are global/discovered, so they are ' +
            'reported as posture, not per-tenant numbers.',
    });

export const QuotaStandingResourceSchema = z
    .object({
        resource: z.string(),
        name: z.string(),
        burst: QuotaStandingWindowSchema,
        quota: QuotaStandingWindowSchema,
    })
    .meta({ id: 'QuotaStandingResource' });

export const QuotaStandingAdmissionClassSchema = z
    .object({
        class: z.string().meta({ description: 'Workflow class (e.g. ExecuteConversationWorkflow).' }),
        tenant_active: z.number().meta({ description: "This tenant's currently active (leased) slots for the class." }),
    })
    .meta({ id: 'QuotaStandingAdmissionClass' });

export const QuotaStandingResponseSchema = z
    .object({
        tenant_id: z.string(),
        available: z.boolean().meta({
            description:
                'False when the limiter store (Redis) was unavailable, so `api`/`admission` are empty because ' +
                'standing could not be read — NOT because there are no limits. Limiters fail open in this case.',
        }),
        base_tier: z
            .string()
            .meta({ description: 'Deployment base tier (env QUOTA_BASE_TIER); `default` = the static limits stand.' }),
        effective_tier: QuotaEffectiveTierSchema.meta({
            description:
                'Tier used to compute the API limits below: explicit account `quota_tier`, else account_type ' +
                'derived tier, else `base_tier` when the account tier could not be resolved.',
        }),
        api: z.array(QuotaStandingResourceSchema).meta({
            description: 'Per-resource API rate-limit standing (effective limits + current usage).',
        }),
        // Anonymous in the interface and anonymous in the document, so it stays inline here rather than
        // becoming a named component — naming it would add a `$ref` the spec does not currently publish.
        admission: z
            .object({
                classes: z.array(QuotaStandingAdmissionClassSchema),
                note: z.string(),
            })
            .meta({
                description:
                    'Workflow admission: per-tenant active slots per probed class. The budget itself is global and ' +
                    'discovered (AIMD), not a per-tenant number — this is occupancy, not a limit.',
            }),
        llm: z.object({ note: z.string() }).meta({
            description: 'The LLM interaction limiter is shared per environment/model, not per tenant.',
        }),
    })
    .meta({ id: 'QuotaStandingResponse' });

export const QuotaTierResponseSchema = z
    .object({
        tier: QuotaEffectiveTierSchema,
    })
    .meta({
        id: 'QuotaTierResponse',
        description:
            'Lightweight per-account quota tier for the calling account — served by `GET /api/v1/quota/tier`. ' +
            "A cheap, cacheable read that lets another service (e.g. zeno-server's API rate limiter) resolve " +
            "the caller's tier through studio-server instead of reaching into the account store directly. " +
            "`tier` is the SAME value  {@link  QuotaStandingResponse.effective_tier }  reports: the account's " +
            'explicit `quota_tier`, else its account_type-derived tier, else the deployment base tier when the ' +
            'account tier cannot be resolved.',
    });

/**
 * The public quota types, inferred rather than written.
 *
 * Every schema in the closure gets one — not only the two the endpoints return. A hand-written
 * `QuotaStandingWindow` sitting beside an inferred `QuotaStandingResponse` would create two
 * definitions of one contract, only one of which OpenAPI publishes and AJV compiles.
 * `../rate-limiter.ts` re-exports these under their public names.
 */
export type QuotaEffectiveTierFromSchema = z.infer<typeof QuotaEffectiveTierSchema>;
export type QuotaStandingWindowFromSchema = z.infer<typeof QuotaStandingWindowSchema>;
export type QuotaStandingResourceFromSchema = z.infer<typeof QuotaStandingResourceSchema>;
export type QuotaStandingAdmissionClassFromSchema = z.infer<typeof QuotaStandingAdmissionClassSchema>;
export type QuotaStandingResponseFromSchema = z.infer<typeof QuotaStandingResponseSchema>;
export type QuotaTierResponseFromSchema = z.infer<typeof QuotaTierResponseSchema>;
