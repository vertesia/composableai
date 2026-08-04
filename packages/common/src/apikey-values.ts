/**
 * API key values that exist at runtime.
 *
 * Split out of `apikey.ts` so `api-schemas/apikey.ts` can read the enum without importing a module
 * that derives its types from those very schemas. Re-exported from `apikey.ts`.
 */

export enum ApiKeyTypes {
    secret = 'sk',
}
