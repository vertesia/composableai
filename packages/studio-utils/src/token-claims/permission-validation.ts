import { ACCOUNT_SCOPED_PERMISSIONS, type AuthTokenPayload } from '@vertesia/common';

export class InvalidTokenPermissionClaimsError extends Error {
    constructor() {
        super('Invalid token permission claims');
        this.name = 'InvalidTokenPermissionClaimsError';
    }
}

function isPermissionList(value: unknown): value is string[] {
    return (
        Array.isArray(value) &&
        value.every(
            (permission) => typeof permission === 'string' && permission.length > 0 && !/\s/.test(permission),
        ) &&
        new Set(value).size === value.length
    );
}

/**
 * Validate final claims before signing and after backend JWT verification, including delegated principals.
 * Do not call from browser decoding or individual permission checks. This neither repairs claims nor
 * verifies signatures. Unknown permission names are allowed so an older
 * consumer can accept tokens from a newer issuer without maintaining a second permission catalog.
 */
export function assertTokenPermissionClaims(
    token: Pick<AuthTokenPayload, 'permissions' | 'account_permissions' | 'service_caller'>,
): void {
    if (typeof token !== 'object' || token === null || Array.isArray(token)) {
        throw new InvalidTokenPermissionClaimsError();
    }
    // TODO(2026-11-02, LEGACY_PERMISSION_CLAIMS): remove pre-normalization compatibility after
    // all issuers are upgraded in prod and old tokens expire. See Studio docs/jwt-permission-claims-migration.md.
    // Require both arrays then; remove only the absence guard, not the validation inside it.
    if (token.account_permissions !== undefined) {
        const { permissions, account_permissions: accountPermissions } = token;
        if (!isPermissionList(permissions) || !isPermissionList(accountPermissions)) {
            throw new InvalidTokenPermissionClaimsError();
        }
        const granted = new Set(permissions);
        const accountGranted = new Set(accountPermissions);
        if (
            accountPermissions.some((permission) => !granted.has(permission)) ||
            ACCOUNT_SCOPED_PERMISSIONS.some((permission) => granted.has(permission) && !accountGranted.has(permission))
        ) {
            throw new InvalidTokenPermissionClaimsError();
        }
    }
    const onBehalfOf = token.service_caller?.onBehalfOf;
    if (onBehalfOf) assertTokenPermissionClaims(onBehalfOf);
}
