import { type AuthTokenPayload, type Permission, PrincipalType, type SystemRoleDefinition } from '@vertesia/common';
import { ErrorBox, errorMessage, useFetch } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { createContext, useContext, useMemo } from 'react';
import { isAnyOf } from './helpers';

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
}
export function UserPermissionProvider({ children }: UserPermissionProviderProps) {
    const { t } = useUITranslation();
    const session = useUserSession();
    const authToken = session.authToken;
    const shouldFetchRoleMappings = Boolean(authToken && !authToken.permissions);
    const { data, error, isLoading } = useFetch<ListRolesResponse | undefined>(() => {
        if (shouldFetchRoleMappings) {
            return session.client.iam.roles.listSystem();
        }
        return Promise.resolve(undefined);
    }, [session, shouldFetchRoleMappings]);

    const perms = useMemo(() => {
        if (authToken) {
            if (authToken.permissions || !shouldFetchRoleMappings) {
                return new UserPermissions(authToken);
            }
            if (data && !isLoading) {
                return new UserPermissions(authToken, data);
            }
        } else {
            return undefined;
        }
        return undefined;
    }, [authToken, data, isLoading, shouldFetchRoleMappings]);

    if (error) {
        return <ErrorBox title={t('store.failedToFetchRoleMappings')}>{errorMessage(error)}</ErrorBox>;
    }

    return perms && <UserPermissionsContext.Provider value={perms}>{children}</UserPermissionsContext.Provider>;
}
