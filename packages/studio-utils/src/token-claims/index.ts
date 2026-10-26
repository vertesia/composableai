import type { ContentSecurity } from '@vertesia/common';

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
