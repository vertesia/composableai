import type { AuthTokenPayload } from '@vertesia/common';

export type TokenPermissionClaims = Required<Pick<AuthTokenPayload, 'permissions' | 'account_permissions'>>;

/**
 * Read final permission claims without copying, filtering, or expanding them. Authentication
 * boundaries must verify the JWT and call assertTokenPermissionClaims before consumers use it.
 *
 * A legacy access token was minted by an issuer without the normalized permission contract:
 * it lacks `account_permissions`, and `permissions` may be absent or only an OAuth scope cap.
 * Returning undefined identifies that unresolved format, not an empty set of grants.
 * An empty `account_permissions` array is normalized and must not trigger legacy role expansion.
 * Unsigned minting payloads also lack these claims until the issuer resolves their authority.
 *
 * Consumer legacy support can be retired only after every trusted issuer stops emitting that
 * format and its last tokens expire, including verification clock tolerance. Use the longest
 * supported token lifetime, not just the one-hour browser session; older rollback revisions
 * must no longer be allowed to emit it. Mint-time role expansion is still needed afterwards.
 */
export function readTokenPermissionClaims(
    token: Pick<AuthTokenPayload, 'permissions' | 'account_permissions'>,
): TokenPermissionClaims | undefined {
    // LEGACY_PERMISSION_CLAIMS: remove this alternate format after the issuer/expiry migration.
    if (token.account_permissions === undefined) return undefined;
    const claims = token as TokenPermissionClaims;
    return {
        permissions: claims.permissions,
        account_permissions: claims.account_permissions,
    };
}
