import { Permission } from './access-control.js';
import { ProjectRoles } from './project.js';

export class Role {
    permissions: Set<Permission>;
    constructor(
        public name: ProjectRoles,
        permissions: Permission[],
    ) {
        this.permissions = new Set(permissions);
    }

    hasPermission(permission: Permission) {
        return this.permissions.has(permission);
    }
}

export class RoleList {
    private constructor(public readonly roles: Role[]) {}

    static fromRoleNames(roleNames: ProjectRoles[]): RoleList {
        const roles = roleNames.map((r) => getRoleByName(r));
        return new RoleList(roles);
    }

    static fromRoleName(roleName: ProjectRoles): RoleList {
        const roles = [getRoleByName(roleName)];
        return new RoleList(roles);
    }

    hasPermission(perm: Permission): boolean {
        return this.roles.some((role) => role.hasPermission(perm));
    }
}

class OrgMemberRole extends Role {
    constructor(
        public name: ProjectRoles,
        permissions: Permission[],
    ) {
        super(name, [Permission.account_member, ...permissions]);
    }
}

class OwnerRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.owner, Object.values(Permission));
    }
}

class AdminRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.admin, Object.values(Permission));
    }
}

class ManagerRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.manager, Object.values(Permission));
        this.permissions.delete(Permission.account_admin);
        this.permissions.delete(Permission.manage_billing);
        this.permissions.delete(Permission.audit_read);
        this.permissions.delete(Permission.agent_run_read);
        this.permissions.delete(Permission.content_read_all);
        this.permissions.delete(Permission.content_superadmin);
        this.permissions.delete(Permission.workflow_superadmin);
    }
}

class DeveloperRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.developer, Object.values(Permission));
        this.permissions.delete(Permission.account_admin);
        this.permissions.delete(Permission.project_admin);
        this.permissions.delete(Permission.project_settings_write);
        this.permissions.delete(Permission.env_admin);
        this.permissions.delete(Permission.manage_billing);
        this.permissions.delete(Permission.audit_read);
        this.permissions.delete(Permission.agent_run_read);
        this.permissions.delete(Permission.content_read_all);
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
            Permission.content_admin, // required for now as we need to create types
            Permission.project_admin,
            Permission.workflow_run,
            Permission.project_settings_write,
            Permission.account_write,
        ]);
    }
}

class AutomationRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.automation, [
            Permission.content_read,
            Permission.content_write,
            Permission.content_admin,
            Permission.int_read,
            Permission.int_execute,
            Permission.run_read,
            Permission.workflow_run,
            Permission.project_integration_read,
        ]);
    }
}

class ContentProcessorRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.content_processor, [
            Permission.content_read,
            Permission.content_write,
            Permission.content_admin,
            Permission.content_superadmin,
            Permission.int_execute,
            Permission.workflow_read,
            Permission.workflow_run,
            Permission.run_read,
        ]);
    }
}

class ConsumerRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.consumer, [
            Permission.content_admin, // Temporary permission; micro apps will need to create types instead via user roles
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
        super(ProjectRoles.executor, [Permission.int_execute, Permission.run_read, Permission.workflow_run]);
    }
}

class ReaderRole extends OrgMemberRole {
    constructor() {
        super(ProjectRoles.reader, [Permission.int_read, Permission.run_read, Permission.content_read]);
    }
}

const READ_ONLY_AUDIT_PERMISSIONS = [
    Permission.studio_access,
    Permission.account_read,
    Permission.project_integration_read,
    Permission.api_key_read,
    Permission.billing_read,
    Permission.audit_read,
    Permission.int_read,
    Permission.run_read,
    Permission.content_read,
    Permission.content_read_all,
    Permission.task_read,
    Permission.workflow_read,
    Permission.agent_run_read,
];

class ReadOnlyAuditRole extends OrgMemberRole {
    constructor(name: ProjectRoles.auditor | ProjectRoles.support) {
        super(name, READ_ONLY_AUDIT_PERMISSIONS);
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

class ContentSuperAdmin extends DeveloperRole {
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
    [ProjectRoles.automation]: new AutomationRole(),
    [ProjectRoles.content_processor]: new ContentProcessorRole(),
    [ProjectRoles.consumer]: new ConsumerRole(),
    [ProjectRoles.executor]: new ExecutorRole(),
    [ProjectRoles.reader]: new ReaderRole(),
    [ProjectRoles.auditor]: new ReadOnlyAuditRole(ProjectRoles.auditor),
    [ProjectRoles.support]: new ReadOnlyAuditRole(ProjectRoles.support),
    [ProjectRoles.billing]: new BillingRole(),
    [ProjectRoles.app_member]: new AppMemberRole(),
    [ProjectRoles.member]: new OrgMemberRole(ProjectRoles.member, []),
    [ProjectRoles.content_superadmin]: new ContentSuperAdmin(),
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
