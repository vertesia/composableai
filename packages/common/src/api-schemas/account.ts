import { z } from 'zod';
// From the values module, never from `user.ts`: `user.ts` derives its public types from the schemas
// below, so importing it here would invert the dependency and make the source of truth circular.
import { ACCOUNT_APP_ACCESS_MESSAGE_MAX_LENGTH, AccountType, BillingMethod, QuotaTier } from '../account-values.js';

/**
 * Runtime API schemas for the Accounts endpoints.
 *
 * These describe the WIRE shape — what actually crosses the HTTP boundary — which is not
 * always what the hand-written interfaces in `user.ts` claim. Divergences are asserted in
 * `account.contract.test.ts` rather than papered over.
 *
 * This module is only reachable through the `@vertesia/common/api-schemas` subpath. It must
 * never be runtime-exported from the package root: `lib/index.js` is bundled wholesale into
 * `lib/vertesia-common.js` and served to browsers, so a root re-export would ship zod to every
 * UI user. The root may re-export the derived TYPES with `export type`, which tsc erases.
 */

/**
 * Shared enums carry an `id` so the adapter hoists them into named components and properties
 * reference them, rather than each property carrying its own inline copy. The distinction is
 * invisible to JSON Schema validation and decisive for codegen: a named component becomes one
 * reusable Java/Go enum type, while inline copies become an anonymous type per property. These
 * names also already exist in the published spec, so keeping them avoids a breaking rename for
 * everyone generating from it.
 */
export const BillingMethodSchema = z.enum(BillingMethod).meta({ id: 'BillingMethod' });
export const AccountTypeSchema = z.enum(AccountType).meta({ id: 'AccountType' });
export const QuotaTierSchema = z.enum(QuotaTier).meta({
    id: 'QuotaTier',
    description:
        'Quota/rate-limit tier assigned to an account. Code-defined tiers live in `@dglabs/quota` ' +
        '(`QUOTA_TIERS`); these names must match its keys.\n' +
        '- `standard` — protective baseline limits (the default for most accounts).\n' +
        '- `enterprise` — high limits for contracted customers / internal / partners.\n\n' +
        'An account with no explicit `quota_tier` derives its tier from its `account_type`.',
});

export const AccountBillingSchema = z
    .object({
        method: BillingMethodSchema,
        stripe_customer_id: z.string().optional(),
    })
    .meta({ id: 'AccountBilling' });

export const AccountSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        // JSDoc is invisible to `toJSONSchema` — a description only reaches the published spec
        // through `.meta()`. These strings are the ones the TypeScript-derived spec used to carry.
        namespace: z
            .string()
            .meta({ description: 'Public DNS-label-compatible identifier used by organization app domains.' })
            .optional(),
        app_access_message: z
            .string()
            .max(ACCOUNT_APP_ACCESS_MESSAGE_MAX_LENGTH)
            .meta({
                description: 'Plain-text instructions shown when a signed-in user has no application access.',
            })
            .optional(),
        email_domains: z.array(z.string()),
        // strictObject rather than object: the previously published spec closed this nested
        // object, and STRICT_COMPONENTS only reaches top-level components.
        onboarding: z.strictObject({
            completed: z.boolean(),
            /**
             * String on the wire and optional: the Mongo field has no default and is only written
             * when onboarding completes.
             */
            completed_at: z.string().meta({ format: 'date-time' }).optional(),
        }),
        datacenter: z.string(),
        account_type: AccountTypeSchema,
        billing: AccountBillingSchema,
        quota_tier: QuotaTierSchema.meta({
            description: 'Quota/rate-limit tier. Unset → the deployment default tier (env `QUOTA_BASE_TIER`).',
        }).optional(),
        feature_flags: z
            .record(z.string(), z.unknown())
            .meta({
                description:
                    'Ops-managed per-account feature flags. Untyped by design so operators can add / remove ' +
                    'temporary rollout gates without a schema change. Keys are enumerated in the admin UI from ' +
                    'a hardcoded registry (studio-server) — flags not in that registry are ignored. Not ' +
                    'modifiable through the public account API; admin API only.',
            })
            .optional(),
        created_by: z.string(),
        updated_by: z.string(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'Account' });

/**
 * No `quota_tier`. The previously published payload declared it, but `PUT /account` never applied
 * it — the field is written only through the admin quota API. Documenting a field the handler
 * ignores is the drift this work exists to remove, and once request validation enforces the
 * schema, a client sending it gets an honest 400 instead of silence. It also closes the door on a
 * future "fix" that would let an account admin raise their own rate-limit tier through the public
 * API.
 */
export const UpdateAccountPayloadSchema = z
    .object({
        name: z.string().optional(),
        app_access_message: z.string().max(ACCOUNT_APP_ACCESS_MESSAGE_MAX_LENGTH).optional(),
        email_domains: z.array(z.string()).optional(),
        billing: AccountBillingSchema.optional(),
    })
    .meta({ id: 'UpdateAccountPayload' });

/**
 * Stripe billing status, modelled as a real discriminated union.
 *
 * The hand-written `StripeBillingStatusResponse` in `meters.ts` flattens this into one object
 * with `portal_url?` and `reason?` both optional, so a generated Java/Go client gets two
 * unrelated optionals and no way to know which is populated. The server only ever sets
 * `portal_url` when enabled and `reason` when disabled.
 */
export const StripeBillingEnabledSchema = z
    .object({
        status: z.literal('enabled'),
        /**
         * Only ever `stripe`. The handler returns the enabled branch exclusively after checking
         * `account.billing.method === BillingMethod.stripe`, so widening this to the full enum
         * would describe states the server cannot produce.
         */
        billing_method: z.literal(BillingMethod.stripe),
        portal_url: z.string(),
    })
    .meta({ id: 'StripeBillingEnabled' });

export const StripeBillingDisabledSchema = z
    .object({
        status: z.literal('disabled'),
        billing_method: BillingMethodSchema.nullable(),
        reason: z.string(),
    })
    .meta({ id: 'StripeBillingDisabled' });

export const StripeBillingStatusResponseSchema = z
    .discriminatedUnion('status', [StripeBillingEnabledSchema, StripeBillingDisabledSchema])
    .meta({ id: 'StripeBillingStatusResponse' });

export type AccountBillingFromSchema = z.infer<typeof AccountBillingSchema>;
export type AccountFromSchema = z.infer<typeof AccountSchema>;
export type UpdateAccountPayloadFromSchema = z.infer<typeof UpdateAccountPayloadSchema>;
export type StripeBillingStatusResponseFromSchema = z.infer<typeof StripeBillingStatusResponseSchema>;
