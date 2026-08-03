/**
 * Transient-token values that exist at runtime.
 *
 * Split out of `transient-tokens.ts` so `api-schemas/invites.ts` can read the enum without importing
 * a module that derives its types from those very schemas. Re-exported from `transient-tokens.ts`.
 */

export enum TransientTokenType {
    userInvite = 'user-invite',
    migration = 'migration',
}
