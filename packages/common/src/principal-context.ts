import type { AbacPrincipalContextFromSchema } from './api-schemas/user.js';
import type * as Wire from './wire-types.generated.js';

/**
 * The resolved principal context matched by ResourceSet/PrincipalSet condition evaluation
 * (`resolveConditions` / `matchConditions`) and offered by the UI condition editor. Every field is
 * referenceable in a rule as `$principal.<field>`: the principal `kind`, its `id`, and the merged
 * BLP attributes (clearance, compartments, email, tags, properties).
 *
 * This is the single shape the token server writes into the JWT for `$principal.*` resolution at
 * issue time, and the shared `buildPrincipalContext` in @vertesia/studio-utils produces — with the
 * defaults that keep condition operators well-defined for absent values (clearance = 0,
 * compartments = [], tags = [], properties = {}, id = '', email = '').
 *
 * Derived from `AbacPrincipalContextSchema`, which is composed into `PrincipalIdentitySchema` rather
 * than published as a component of its own — the document has never carried an `AbacPrincipalContext`
 * schema, and inventing one would add a `$ref` to every generated client.
 */
export type AbacPrincipalContext = AbacPrincipalContextFromSchema;

/**
 * The principal subject kind. A resolvable field of {@link AbacPrincipalContext}, so rules may match
 * on `$principal.kind`.
 */
export type PrincipalKind = AbacPrincipalContext['kind'];

/**
 * Response shape of the `/iam/users/identity` endpoint. Extends {@link AbacPrincipalContext} with
 * identity-only fields (none today) — the invariant is that the ABAC context is always a subset of
 * the identity, so a field added here never widens the `$principal.*` surface. Derived from
 * `PrincipalIdentitySchema`, where its published description lives — Zod reads `.meta()`, not TSDoc.
 */
export type PrincipalIdentity = Wire.PrincipalIdentity;
