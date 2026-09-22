import type { AbacPrincipalContext, PrincipalKind } from '@vertesia/common';

/**
 * The shared principal-context builder, consumed by both the token server (JWT `$principal.*`
 * resolution at mint time) and studio-server (the `/iam/users/identity` endpoint). It is the single
 * home for logic that used to be duplicated in `apps/token-server` and `apps/studio-server` and kept
 * in sync by hand; the produced {@link AbacPrincipalContext} is exactly the shape ABAC rules resolve
 * against.
 *
 * Browser-safe (pure, no Node built-ins): the UI condition editor lives downstream of the same
 * `@vertesia/common` shape, and this package must stay loadable in the browser bundle.
 */

/**
 * A user, group, or api-key record as it comes out of Mongo, where every optional field can be null
 * as well as absent — which the inferred persistence types say out loud. The merge treats null and
 * absent identically, so nothing about the resulting context changes; what changes is that the
 * nullability is handled rather than asserted away at the call site.
 */
export interface MergeSource {
    properties?: Record<string, unknown> | null;
    clearance?: number | null;
    compartments?: string[] | null;
    tags?: string[] | null;
}

export interface MergedUserFields {
    properties?: Record<string, unknown>;
    clearance?: number;
    compartments?: string[];
    tags?: string[];
}

/**
 * Merge properties, clearance, compartments, and tags from groups + the principal.
 *
 * - properties: array values are deduplicated union, scalars use last-write-wins (principal wins)
 * - clearance: max across all defined values (most permissive wins)
 * - compartments / tags: deduplicated union of all arrays
 *
 * Used for the user token path (user + covering groups). The api-key path has no groups to merge and
 * passes the key document straight to {@link buildPrincipalContext} as `fields`.
 */
export function mergeUserFields(groups: MergeSource[], user: MergeSource): MergedUserFields {
    const mergedProps: Record<string, unknown> = {};
    let maxClearance: number | undefined;
    const allCompartments = new Set<string>();
    const allTags = new Set<string>();

    for (const source of [...groups, user]) {
        if (source.properties) {
            for (const [key, value] of Object.entries(source.properties)) {
                if (Array.isArray(value)) {
                    const existing = mergedProps[key];
                    if (Array.isArray(existing)) {
                        const set = new Set([...existing, ...value]);
                        mergedProps[key] = Array.from(set);
                    } else {
                        mergedProps[key] = [...value];
                    }
                } else {
                    mergedProps[key] = value;
                }
            }
        }

        // `!= null` rather than `!== undefined`: a stored null means "no clearance recorded", the
        // same as an absent field, and must not reach Math.max where it would read as 0.
        if (source.clearance != null) {
            maxClearance = maxClearance !== undefined ? Math.max(maxClearance, source.clearance) : source.clearance;
        }

        if (source.compartments) {
            for (const c of source.compartments) {
                allCompartments.add(c);
            }
        }

        if (source.tags) {
            for (const t of source.tags) {
                allTags.add(t);
            }
        }
    }

    return {
        properties: Object.keys(mergedProps).length > 0 ? mergedProps : undefined,
        clearance: maxClearance,
        compartments: allCompartments.size > 0 ? Array.from(allCompartments) : undefined,
        tags: allTags.size > 0 ? Array.from(allTags) : undefined,
    };
}

/**
 * Build the {@link AbacPrincipalContext} consumed by ResourceSet/PrincipalSet condition evaluation
 * and mirrored into the JWT for runtime `$principal.*` resolution.
 *
 * - user:   pass `mergeUserFields(groups, user)` as fields, the user's email, and the user id
 * - apikey: pass the api key document itself (it carries optional properties/clearance/compartments)
 *   and the api key id
 *
 * Defaults are applied so condition operators have well-defined behaviour when the principal has no
 * merged value: clearance → 0, compartments → [], tags → [], properties → {}, id → '', email → ''.
 * `email` is published optional on the wire but defaulted to '' here so `$principal.email` resolves
 * to a string rather than undefined during rule evaluation.
 */
export function buildPrincipalContext(
    kind: PrincipalKind,
    fields: MergeSource,
    email?: string | null,
    id?: string,
): AbacPrincipalContext {
    return {
        kind,
        id: id ?? '',
        clearance: fields.clearance ?? 0,
        compartments: fields.compartments ?? [],
        email: email ?? '',
        tags: fields.tags ?? [],
        properties: fields.properties ?? {},
    };
}
