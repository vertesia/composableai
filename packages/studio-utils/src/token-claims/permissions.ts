import { ACCOUNT_SCOPED_PERMISSIONS, type AuthTokenPayload } from '@vertesia/common';

export type TokenPermissionClaims = Required<Pick<AuthTokenPayload, 'permissions' | 'account_permissions'>>;

function stringList(value: unknown): string[] {
    return Array.isArray(value)
        ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
        : [];
}

/** Read normalized claims from a verified token. Undefined means the legacy contract, not no grants. */
export function readTokenPermissionClaims(
    token: Pick<AuthTokenPayload, 'permissions' | 'account_permissions'>,
): TokenPermissionClaims | undefined {
    if (token.account_permissions === undefined) return undefined;

    const permissions = stringList(token.permissions);
    const granted = new Set(permissions);
    const accountPermissions = stringList(token.account_permissions).filter((permission) => granted.has(permission));
    const accountGranted = new Set(accountPermissions);
    const accountOnly = new Set<string>(ACCOUNT_SCOPED_PERMISSIONS);
    return {
        permissions: permissions.filter((permission) => !accountOnly.has(permission) || accountGranted.has(permission)),
        account_permissions: accountPermissions,
    };
}
