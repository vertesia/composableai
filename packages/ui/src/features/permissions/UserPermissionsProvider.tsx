import { Permission, ProjectRoles } from "@vertesia/common"
import { ErrorBox, useFetch } from "@vertesia/ui/core"
import { UserSession, useUserSession } from "@vertesia/ui/session"
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

    constructor(session: UserSession, roles: ListRolesResponse) {
        if (!session.authToken) {
            throw new Error('No auth token found in user session')
        }
        this.system_roles = roles;
        const userRoles = new Set<string>(session.authToken.account_roles || []);
        if (session.authToken.project_roles) {
            for (const role of session.authToken.project_roles) {
                userRoles.add(role);
            }
        }
        this.roles = userRoles;
        // build a temporary role to permissions map
        const map: Record<string, Permission[]> = {};
        for (const role of roles) {
            map[role.name] = role.permissions;
        }
        const permissions = new Set<string>();
        for (const role of userRoles) {
            const rolePermissions = map[role];
            if (rolePermissions) {
                for (const permission of rolePermissions) {
                    permissions.add(permission);
                }
            }
        }
        this.permissions = permissions;
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
    const { data, error, isLoading } = useFetch<ListRolesResponse | undefined>(() => {
        if (session.user) {
            return session.client.iam.roles.list();
        } else {
            return Promise.resolve(undefined);
        }
    }, [session.user]);

    const perms = useMemo(() => {
        if (session.authToken && data && !isLoading) {
            return new UserPermissions(session, data);
        } else {
            return undefined;
        }
    }, [session, data, isLoading]);

    if (error) {
        return <ErrorBox title="Failed to fetch role mappings">{error.message}</ErrorBox>
    }

    return perms && (
        <UserPermissionsContext.Provider value={perms}>{children}</UserPermissionsContext.Provider>
    )
}
