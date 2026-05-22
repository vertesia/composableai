import { getPermissionsForRoles, listRoles, Permission, ProjectRoles, type AuthTokenPayload } from "@vertesia/common"
import { useUserSession } from "@vertesia/ui/session"
import { createContext, useContext, useMemo } from "react"
import { isAnyOf } from "./helpers"

type ListRolesResponse = {
    name: ProjectRoles,
    permissions: Permission[]
}[];

export class UserPermissions {
    system_roles: ListRolesResponse; // all roles defined in the system
    roles: Set<string>; // all roles of the current user
    permissions: Set<string>; // all permissions of the current user

    constructor(authToken: AuthTokenPayload) {
        this.system_roles = listRoles().map(role => ({
            name: role.name,
            permissions: Array.from(role.permissions),
        }));
        const roleNames = [...(authToken.account_roles || []), ...(authToken.project_roles || [])];
        const userRoles = new Set<string>(roleNames);
        this.roles = userRoles;
        this.permissions = new Set(authToken.permissions ?? getPermissionsForRoles(roleNames));
    }


    hasPermission(permission: string | string[]) {
        if (typeof permission === 'string') {
            return this.permissions.has(permission);
        } else if (isAnyOf(permission as Permission[])) {
            return permission.some(p => this.permissions.has(p));
        } else { // all of
            for (const p of permission) {
                if (!this.permissions.has(p)) {
                    return false;
                }
            }
            return true;
        }
    }

}

const UserPermissionsContext = createContext<UserPermissions | undefined>(undefined)
export { UserPermissionsContext }

export function useUserPermissions() {
    const perms = useContext(UserPermissionsContext);
    if (!perms) {
        throw new Error('UserPermissionContext cannot be used outside UserPermissionProvider')
    }
    return perms;
}

interface UserPermissionProviderProps {
    children: React.ReactNode
}
export function UserPermissionProvider({ children }: UserPermissionProviderProps) {
    const session = useUserSession();
    const authToken = session.authToken;

    const perms = useMemo(() => {
        if (authToken) {
            return new UserPermissions(authToken);
        } else {
            return undefined;
        }
    }, [authToken]);

    return perms && (
        <UserPermissionsContext.Provider value={perms}>{children}</UserPermissionsContext.Provider>
    )
}
