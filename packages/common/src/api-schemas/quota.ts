import { z } from 'zod';

/**
 * Runtime API schemas for the quota endpoints — the first resource converted in bulk.
 *
 * Both slots are `response:200`, which is why this resource went first. Responses are DETECTED rather
 * than prevented outside local development, so converting one cannot reject a caller's request: the
 * worst case is a logged warning about our own drift. That makes it the cheapest place to establish
 * the conversion method before touching a request body.
 *
 * The published document must not move. Every description below is the TSDoc text the scanner
 * currently derives, carried across verbatim, and the `id` on each nested schema reproduces the
 * component the document already `$ref`s. `check:openapi` diffs the regenerated spec against the
 * committed one, so any drift from the shapes in `../rate-limiter.ts` fails the build rather than
 * silently renegotiating a public contract.
 *
 * The whole `$ref` closure moves together and has to: the registry must be self-contained, so a
 * canonical component referencing a TypeScript-derived one is a generation error. That is why a
 * two-slot resource brings six schemas.
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
 * Zod does not read comments, so a `/** *\/` block here would document the source and publish nothing —
 * quietly dropping text the document already carries. The component description below is the TSDoc
 * block that sits above `QuotaStandingWindow` in `../rate-limiter.ts`, which is where the scanner
 * currently attaches it.
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

export type QuotaStandingResponseFromSchema = z.infer<typeof QuotaStandingResponseSchema>;
export type QuotaTierResponseFromSchema = z.infer<typeof QuotaTierResponseSchema>;
