import { Permission } from './access-control.js';
import { ProjectRoles } from './project.js';

export class Role {
    readonly permissions: Set<Permission>;

    constructor(public name: ProjectRoles, permissions: Permission[]) {
        this.permissions = new Set(permissions);
    }

    hasPermission(permission: Permission) {
        return this.permissions.has(permission);
    }
}

export class RoleList {
    private constructor(public readonly roles: Role[]) {}

    static fromRoleNames(roleNames: ProjectRoles[]): RoleList {
        return new RoleList(roleNames.map(roleName => getRoleByName(roleName)));
    }

    static fromRoleName(roleName: ProjectRoles): RoleList {
        return new RoleList([getRoleByName(roleName)]);
    }

    hasPermission(permission: Permission): boolean {
        return this.roles.some(role => role.hasPermission(permission));
    }
}

class OrgMemberRole extends Role {
    constructor(name: ProjectRoles, permissions: Permission[]) {
        super(name, [Permission.account_member, ...permissions]);
    }
}

class OwnerRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.owner, Object.values(Permission) as Permission[]);
    }
}

class AdminRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.admin, Object.values(Permission) as Permission[]);
    }
}

class ManagerRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.manager, Object.values(Permission) as Permission[]);
        this.permissions.delete(Permission.account_admin);
        this.permissions.delete(Permission.manage_billing);
        this.permissions.delete(Permission.content_superadmin);
        this.permissions.delete(Permission.workflow_superadmin);
    }
}

class DeveloperRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.developer, Object.values(Permission) as Permission[]);
        this.permissions.delete(Permission.account_admin);
        this.permissions.delete(Permission.project_admin);
        this.permissions.delete(Permission.project_settings_write);
        this.permissions.delete(Permission.env_admin);
        this.permissions.delete(Permission.manage_billing);
        this.permissions.delete(Permission.content_superadmin);
        this.permissions.delete(Permission.workflow_superadmin);
    }
}

class ApplicationRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.application, [
            Permission.int_read,
            Permission.int_execute,
            Permission.int_write,
            Permission.run_read,
            Permission.content_write,
            Permission.content_read,
            Permission.content_write,
            Permission.content_admin,
            Permission.project_admin,
            Permission.workflow_run,
            Permission.project_settings_write,
            Permission.account_write,
        ]);
    }
}

class ConsumerRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.consumer, [
            Permission.content_admin,
            Permission.content_read,
            Permission.content_write,
            Permission.content_delete,
            Permission.int_read,
            Permission.int_execute,
            Permission.run_read,
            Permission.workflow_run,
        ]);
    }
}

class ExecutorRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.executor, [
            Permission.int_execute,
            Permission.run_read,
            Permission.workflow_run,
        ]);
    }
}

class ReaderRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.reader, [
            Permission.int_read,
            Permission.run_read,
            Permission.content_read,
        ]);
    }
}

class BillingRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.billing, [Permission.manage_billing]);
    }
}

class AppMemberRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.app_member, [
            Permission.int_read,
            Permission.int_execute,
            Permission.int_write,
            Permission.run_read,
            Permission.content_write,
            Permission.content_read,
            Permission.content_delete,
            Permission.workflow_run,
        ]);
    }
}

class ContentSuperAdminRole extends DeveloperRole {
    constructor() {
        super();
        this.name = ProjectRoles.content_superadmin;
        this.permissions.add(Permission.content_superadmin);
    }
}

const roles: Record<ProjectRoles, Role> = {
    [ProjectRoles.owner]: new OwnerRole(),
    [ProjectRoles.admin]: new AdminRole(),
    [ProjectRoles.manager]: new ManagerRole(),
    [ProjectRoles.developer]: new DeveloperRole(),
    [ProjectRoles.application]: new ApplicationRole(),
    [ProjectRoles.consumer]: new ConsumerRole(),
    [ProjectRoles.executor]: new ExecutorRole(),
    [ProjectRoles.reader]: new ReaderRole(),
    [ProjectRoles.billing]: new BillingRole(),
    [ProjectRoles.app_member]: new AppMemberRole(),
    [ProjectRoles.member]: new OrgMemberRole(ProjectRoles.member, []),
    [ProjectRoles.content_superadmin]: new ContentSuperAdminRole(),
};

export function getRoleByName(name: ProjectRoles): Role {
    const role = roles[name];
    if (!role) throw new Error(`Role ${name} not found`);
    return role;
}

export function listRoles(): Role[] {
    return Object.values(roles);
}

export function getPermissionsForRoles(roleNames: Iterable<ProjectRoles>): Permission[] {
    const permissions = new Set<Permission>();
    for (const roleName of roleNames) {
        const role = getRoleByName(roleName);
        for (const permission of role.permissions) {
            permissions.add(permission);
        }
    }
    return Array.from(permissions);
}
