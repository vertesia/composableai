import { type AuthTokenPayload, type ContentSecurity, PrincipalType } from '@vertesia/common';

export { assertTokenPermissionClaims, InvalidTokenPermissionClaimsError } from './permission-validation.js';
export { readTokenPermissionClaims, type TokenPermissionClaims } from './permissions.js';

/** Values stored behind one opaque token-claim reference. Additional claims can be added later. */
export interface ReferencedTokenClaims {
    abac?: ContentSecurity;
    [claim: string]: unknown;
}

export type ReferencedTokenClaimsLoader = (reference: string) => Promise<ReferencedTokenClaims | undefined>;

/** A signed token refers to state that cannot be recovered. Authorization must fail closed. */
export class TokenClaimReferenceError extends Error {
    constructor(message = 'Referenced token claims are unavailable', options?: ErrorOptions) {
        super(message, options);
        this.name = 'TokenClaimReferenceError';
    }
}

/** Opaque random identifiers, never URLs or arbitrary Redis keys. */
export function isTokenClaimReference(value: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(value);
}

function isClaimObject(value: unknown): value is ContentSecurity {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReferencedAbac(value: unknown): value is ContentSecurity {
    if (!isClaimObject(value)) return false;
    return Object.entries(value).every(([key, conditions]) =>
        Array.isArray(conditions)
            ? conditions.every(isClaimObject)
            : key.startsWith('@') && isReferencedAbac(conditions),
    );
}

/**
 * Return an inline ABAC claim or resolve its opaque reference.
 *
 * Missing inline ABAC is the ordinary unrestricted-token case. A missing referenced value is
 * fundamentally different: treating it as absent would turn a restricted token into an
 * unrestricted one, so malformed and expired references always throw.
 */
export async function resolveAbacClaim(
    claim: ContentSecurity | string | undefined,
    loadReferencedClaims: ReferencedTokenClaimsLoader,
): Promise<ContentSecurity | undefined> {
    if (claim === undefined) return undefined;
    if (typeof claim !== 'string') {
        if (!isClaimObject(claim)) throw new TokenClaimReferenceError('Token contains invalid ABAC');
        return claim;
    }
    if (!isTokenClaimReference(claim)) throw new TokenClaimReferenceError('Token contains an invalid claim reference');

    const referenced = await loadReferencedClaims(claim);
    if (!referenced || typeof referenced !== 'object' || Array.isArray(referenced)) {
        throw new TokenClaimReferenceError();
    }
    const abac = referenced.abac;
    if (!isReferencedAbac(abac)) {
        throw new TokenClaimReferenceError('Referenced token claims do not contain ABAC');
    }
    return abac;
}

/**
 * Claims an agent token holds with the same value as the principal it acts for. The issuer may sign an
 * agent level without its copy and name the claim in `inherited_claims`: the value is then read back from
 * that level's own `service_caller.onBehalfOf` snapshot, which stays inline in the same signed token.
 */
export const INHERITED_AGENT_CLAIMS = ['apps', 'app_installations', 'permissions', 'account_permissions'] as const;
export type InheritedAgentClaim = (typeof INHERITED_AGENT_CLAIMS)[number];

/**
 * The inline value an issuer leaves for each inherited claim, `undefined` meaning the claim is omitted.
 * Each is the most restrictive value its readers accept, so a reader that does not resolve the marker
 * grants nothing it would not grant from an empty claim. The permission lists stay present but empty:
 * a missing `account_permissions` marks a legacy token, which readers interpret differently.
 */
export const INHERITED_AGENT_CLAIM_PLACEHOLDERS: { readonly [C in InheritedAgentClaim]: AuthTokenPayload[C] } = {
    apps: [],
    app_installations: undefined,
    permissions: [],
    account_permissions: [],
};

/** Signed shape of a token whose agent levels may name inherited claims. Resolution removes the marker. */
export type AuthTokenWithInheritedClaims = AuthTokenPayload & { inherited_claims?: InheritedAgentClaim[] };

function isInheritedAgentClaim(claim: unknown): claim is InheritedAgentClaim {
    return (INHERITED_AGENT_CLAIMS as readonly unknown[]).includes(claim);
}

/**
 * Read the claims one token level names in `inherited_claims` from its already-resolved snapshot.
 *
 * Anything the marker cannot honour throws: the inline placeholders are restrictive, so skipping one
 * would silently drop app access, and an unknown name means a newer issuer whose placeholder this
 * version cannot know.
 */
export function readInheritedClaims(
    marker: unknown,
    token: AuthTokenPayload,
    onBehalfOf: AuthTokenPayload | undefined,
): Partial<Pick<AuthTokenPayload, InheritedAgentClaim>> {
    if (marker === undefined) return {};
    if (!Array.isArray(marker) || !marker.every(isInheritedAgentClaim)) {
        throw new TokenClaimReferenceError('Token names an unsupported inherited claim');
    }
    if (token.type !== PrincipalType.Agent || !onBehalfOf) {
        throw new TokenClaimReferenceError('Only an agent token with an onBehalfOf snapshot can inherit claims');
    }
    const inherited: Partial<Pick<AuthTokenPayload, InheritedAgentClaim>> = {};
    for (const claim of marker) {
        const value = onBehalfOf[claim];
        if (value === undefined) throw new TokenClaimReferenceError('Inherited claim is missing from its snapshot');
        Object.assign(inherited, { [claim]: value });
    }
    return inherited;
}

/**
 * Restore the inherited claims of every agent level of a verified token, from the origin outwards.
 * Needs no I/O: every value comes from the same signed token. Other claim references (such as ABAC)
 * are left as they are.
 */
export function resolveInheritedAgentClaims<T extends AuthTokenWithInheritedClaims>(token: T): T {
    const { inherited_claims: marker, ...inline } = token;
    const serviceCaller = inline.service_caller;
    const onBehalfOf = serviceCaller?.onBehalfOf ? resolveInheritedAgentClaims(serviceCaller.onBehalfOf) : undefined;
    // `inherited_claims` is optional in T, so the resolved token, without it, is still a T.
    return {
        ...inline,
        ...readInheritedClaims(marker, inline, onBehalfOf),
        ...(serviceCaller && onBehalfOf ? { service_caller: { ...serviceCaller, onBehalfOf } } : {}),
    } as T;
}
