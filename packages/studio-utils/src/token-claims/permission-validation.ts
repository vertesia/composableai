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
 * Validate once at authentication and signing boundaries, including delegated principals.
 * Never repairs claims or verifies signatures. Unknown permission names are allowed so an older
 * consumer can accept tokens from a newer issuer without maintaining a second permission catalog.
 */
export function assertTokenPermissionClaims(
    token: Pick<AuthTokenPayload, 'permissions' | 'account_permissions' | 'service_caller'>,
): void {
    if (typeof token !== 'object' || token === null || Array.isArray(token)) {
        throw new InvalidTokenPermissionClaimsError();
    }
    // LEGACY_PERMISSION_CLAIMS: absence is accepted during migration, not malformed normalized claims.
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
