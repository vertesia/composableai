import type { PrincipalContextFromSchema, PrincipalIdentityFromSchema } from './api-schemas/user.js';

/**
 * Resolved per-user context consumed by PrincipalSet condition evaluation
 * (`matchConditions` / `resolveConditions`) and by ABAC client-side tooling.
 *
 * Mirrors what the token server builds for `$principal.*` resolution at JWT
 * issue time, with the same defaults (clearance = 0, compartments = [],
 * tags = [], properties = {}). Lives in @vertesia/common so both server-side
 * builders and client-side consumers share the exact same shape.
 *
 * Derived from `PrincipalContextSchema`, which is composed into `PrincipalIdentitySchema` rather
 * than published as a component of its own — the document has never carried a `PrincipalContext`
 * schema, and inventing one would add a `$ref` to every generated client.
 */
export type PrincipalContext = PrincipalContextFromSchema;

/**
 * Response shape of the `/iam/users/identity` endpoint. Derived from `PrincipalIdentitySchema`,
 * where its published description lives — Zod reads `.meta()`, not TSDoc.
 */
export type PrincipalIdentity = PrincipalIdentityFromSchema;
