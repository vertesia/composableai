import { Permission, ProjectRoles } from '@vertesia/common';
import { type Role, type RolePartition, SystemRole } from './classes.js';

class OrgMemberRole extends SystemRole {
    constructor(name: string, permissions: Permission[]) {
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
            Permission.content_admin,
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

// The enum is still named `ProjectRoles` (historical); the partition's domain
// is `system` — the foundational built-in roles, distinct from feature domains
// like `content` or `tasks`. Renaming the enum to `SystemRoles` is a separate
// concern to revisit later.
const systemRoles: Record<ProjectRoles, Role> = {
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

export const systemPartition: RolePartition = {
    domain: 'system',
    roles: new Map(Object.entries(systemRoles)),
};
