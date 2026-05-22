/**
 * Resolved per-user context consumed by PrincipalSet condition evaluation
 * (`matchConditions` / `resolveConditions`) and by ABAC client-side tooling.
 *
 * Mirrors what the token server builds for `$principal.*` resolution at JWT
 * issue time, with the same defaults (clearance = 0, compartments = [],
 * tags = [], properties = {}). Lives in @vertesia/common so both server-side
 * builders and client-side consumers share the exact same shape.
 */
export interface PrincipalContext {
    clearance: number;
    compartments: string[];
    email?: string;
    tags: string[];
    properties: Record<string, unknown>;
}

/**
 * Response shape of the `/iam/users/identity` endpoint: the current principal's
 * {@link PrincipalContext} plus its id. Distinct from `PrincipalContext` itself
 * because the id is identity metadata, not a merged BLP field — adding it to
 * `PrincipalContext` would unintentionally expose `$principal.id` to
 * PrincipalSet rule evaluation.
 */
export interface PrincipalIdentity extends PrincipalContext {
    id: string;
}
