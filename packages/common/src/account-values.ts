/**
 * Account values that exist at runtime — enums, constants, and the pure helpers over them.
 *
 * Split out of `user.ts` so the dependency direction can run one way. The API schemas need these
 * values (`z.enum(BillingMethod)`, `.max(ACCOUNT_APP_ACCESS_MESSAGE_MAX_LENGTH)`), and `user.ts`
 * needs the types the schemas infer. Both living in `user.ts` would make it import from a module
 * that imports it back; here, `user.ts` and `api-schemas/account.ts` both depend on this module and
 * nothing depends on them.
 *
 * Everything here is re-exported from `user.ts`, so existing import paths keep working — this is a
 * move, not a rename.
 */

export enum Datacenters {
    aws = 'aws',
    gcp = 'gcp',
    azure = 'azure',
}

export enum BillingMethod {
    stripe = 'stripe',
    invoice = 'invoice',
}

export enum AccountType {
    vertesia = 'vertesia',
    partner = 'partner',
    free = 'free',
    customer = 'customer',
    prospect = 'prospect',
    unknown = 'unknown',
}

/**
 * Quota/rate-limit tier assigned to an account. Code-defined tiers live in `@dglabs/quota`
 * (`QUOTA_TIERS`); these names must match its keys.
 * - `standard` — protective baseline limits (the default for most accounts).
 * - `enterprise` — high limits for contracted customers / internal / partners.
 *
 * An account with no explicit `quota_tier` derives its tier from its `account_type`.
 */
export enum QuotaTier {
    standard = 'standard',
    enterprise = 'enterprise',
}
export const ACCOUNT_APP_ACCESS_MESSAGE_MAX_LENGTH = 1000;
