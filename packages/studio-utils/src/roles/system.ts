import { Permission, SystemRoles } from '@vertesia/common';
import { type Role, type RolePartition, SystemRole } from './classes.js';

class OrgMemberRole extends SystemRole {
    constructor(name: string, permissions: Permission[]) {
        super(name, [Permission.account_member, ...permissions]);
    }
}

class OwnerRole extends OrgMemberRole {
    constructor() {
        super(SystemRoles.owner, Object.values(Permission));
    }
}

class AdminRole extends OrgMemberRole {
    constructor() {
        super(SystemRoles.admin, Object.values(Permission));
    }
}

class ManagerRole extends OrgMemberRole {
    constructor() {
        super(SystemRoles.manager, Object.values(Permission));
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
        super(SystemRoles.developer, Object.values(Permission));
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
        super(SystemRoles.application, [
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
        super(SystemRoles.automation, [
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
        super(SystemRoles.content_processor, [
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
        super(SystemRoles.consumer, [
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
        super(SystemRoles.executor, [Permission.int_execute, Permission.run_read, Permission.workflow_run]);
    }
}

class ReaderRole extends OrgMemberRole {
    constructor() {
        super(SystemRoles.reader, [Permission.int_read, Permission.run_read, Permission.content_read]);
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
    constructor(name: SystemRoles.auditor | SystemRoles.support) {
        super(name, READ_ONLY_AUDIT_PERMISSIONS);
    }
}

class BillingRole extends OrgMemberRole {
    constructor() {
        super(SystemRoles.billing, [Permission.manage_billing]);
    }
}

class AppMemberRole extends OrgMemberRole {
    constructor() {
        super(SystemRoles.app_member, [
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
        this.name = SystemRoles.content_superadmin;
        this.permissions.add(Permission.content_superadmin);
    }
}

// The enum is still named `SystemRoles` (historical); the partition's domain
// is `system` — the foundational built-in roles, distinct from feature domains
// like `content` or `tasks`. Renaming the enum to `SystemRoles` is a separate
// concern to revisit later.
const systemRoles: Record<SystemRoles, Role> = {
    [SystemRoles.owner]: new OwnerRole(),
    [SystemRoles.admin]: new AdminRole(),
    [SystemRoles.manager]: new ManagerRole(),
    [SystemRoles.developer]: new DeveloperRole(),
    [SystemRoles.application]: new ApplicationRole(),
    [SystemRoles.automation]: new AutomationRole(),
    [SystemRoles.content_processor]: new ContentProcessorRole(),
    [SystemRoles.consumer]: new ConsumerRole(),
    [SystemRoles.executor]: new ExecutorRole(),
    [SystemRoles.reader]: new ReaderRole(),
    [SystemRoles.auditor]: new ReadOnlyAuditRole(SystemRoles.auditor),
    [SystemRoles.support]: new ReadOnlyAuditRole(SystemRoles.support),
    [SystemRoles.billing]: new BillingRole(),
    [SystemRoles.app_member]: new AppMemberRole(),
    [SystemRoles.member]: new OrgMemberRole(SystemRoles.member, []),
    [SystemRoles.content_superadmin]: new ContentSuperAdmin(),
};

export const systemPartition: RolePartition = {
    domain: 'system',
    roles: new Map(Object.entries(systemRoles)),
};
