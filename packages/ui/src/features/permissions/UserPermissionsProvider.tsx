import { type AuthTokenPayload, type Permission, PrincipalType, type SystemRoleDefinition } from '@vertesia/common';
import { Button, errorMessage, Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { createContext, useContext, useMemo } from 'react';
import { isAnyOf } from './helpers';
import { roleMappingsErrorStatus, useRoleMappings } from './useRoleMappings';

type ListRolesResponse = SystemRoleDefinition[];

export class UserPermissions {
    system_roles: ListRolesResponse; // all roles defined in the system
    roles: Set<string>; // all roles of the current user
    permissions: Set<string>; // all permissions of the current user

    constructor(authToken: AuthTokenPayload, roles: ListRolesResponse = []) {
        this.system_roles = roles;
        const roleNames = [...(authToken.account_roles || []), ...(authToken.project_roles || [])];
        const userRoles = new Set<string>(roleNames);
        this.roles = userRoles;
        const rolePermissions = authToken.permissions ?? getPermissionsForRolesFromMappings(roleNames, roles);
        // OAuth access tokens are capped to the permissions granted to the token (its scopes).
        const permissionCap =
            authToken.type === PrincipalType.OAuthAccess ? new Set<string>(authToken.permissions ?? []) : undefined;
        this.permissions = new Set(
            permissionCap ? rolePermissions.filter((permission) => permissionCap.has(permission)) : rolePermissions,
        );
    }

    hasPermission(permission: string | string[]) {
        if (typeof permission === 'string') {
            return this.permissions.has(permission);
        } else if (isAnyOf(permission as Permission[])) {
            return permission.some((p) => this.permissions.has(p));
        } else {
            // all of
            for (const p of permission) {
                if (!this.permissions.has(p)) {
                    return false;
                }
            }
            return true;
        }
    }
}

function getPermissionsForRolesFromMappings(roleNames: Iterable<string>, roles: ListRolesResponse): Permission[] {
    const permissionsByRole = new Map(roles.map((role) => [role.name, role.permissions]));
    const permissions = new Set<Permission>();
    for (const role of roleNames) {
        for (const permission of permissionsByRole.get(role) ?? []) {
            permissions.add(permission);
        }
    }
    return Array.from(permissions);
}

const UserPermissionsContext = createContext<UserPermissions | undefined>(undefined);

export { UserPermissionsContext };

export function useUserPermissions() {
    const perms = useContext(UserPermissionsContext);
    if (!perms) {
        throw new Error('UserPermissionContext cannot be used outside UserPermissionProvider');
    }
    return perms;
}

interface UserPermissionProviderProps {
    children: React.ReactNode;
    loadingIcon?: React.ReactNode;
}
export function UserPermissionProvider({ children, loadingIcon }: UserPermissionProviderProps) {
    const { t } = useUITranslation();
    const session = useUserSession();
    const authToken = session.authToken;
    const { state, retry } = useRoleMappings(session.client, authToken);

    const perms = useMemo(() => {
        if (!authToken) return undefined;
        if (authToken.permissions) {
            return new UserPermissions(authToken);
        }
        if (state.status === 'ready') {
            return new UserPermissions(authToken, state.roles);
        }
        return undefined;
    }, [authToken, state]);

    if (authToken && !perms) {
        const failed = state.status === 'error';
        const status = failed ? roleMappingsErrorStatus(state.error) : undefined;
        const needsSignIn = status === 401;
        const denied = status === 403;
        const title = needsSignIn
            ? t('auth.recovery.credential.title')
            : denied
              ? t('shell.accessDenied')
              : failed
                ? t('permissions.connectionFailed')
                : t('permissions.connecting');
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
                <div className="w-full max-w-md space-y-6 text-center">
                    <div aria-hidden="true" className="flex justify-center">
                        {loadingIcon || (!failed && <Spinner size="2xl" className="text-primary" />)}
                    </div>
                    <div
                        role={failed ? 'alert' : 'status'}
                        aria-live={failed ? 'assertive' : 'polite'}
                        className="space-y-2"
                    >
                        <h1 className="text-xl font-semibold">{title}</h1>
                        <p className="text-muted">
                            {needsSignIn
                                ? t('auth.recovery.credential.body')
                                : denied
                                  ? t('permissions.accessDenied')
                                  : failed
                                    ? t('permissions.tryAgainLater')
                                    : state.status === 'retrying'
                                      ? t('permissions.retrying')
                                      : t('permissions.loadingPermissions')}
                        </p>
                    </div>
                    {failed && (
                        <>
                            <Button variant="outline" onClick={needsSignIn || denied ? () => session.signOut() : retry}>
                                {needsSignIn || denied
                                    ? t('auth.recovery.useDifferentAccount')
                                    : t('auth.recovery.tryAgain')}
                            </Button>
                            {state.error != null && (
                                <details className="text-start text-sm text-muted">
                                    <summary className="cursor-pointer">{t('auth.recovery.technicalDetails')}</summary>
                                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word">
                                        {errorMessage(state.error)}
                                    </pre>
                                </details>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    return perms && <UserPermissionsContext.Provider value={perms}>{children}</UserPermissionsContext.Provider>;
}
