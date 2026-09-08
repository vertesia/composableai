/**
 * Access-control values that exist at runtime — the enums and the scope list.
 *
 * Split out of `access-control.ts` and `roles/types.ts` for the same reason `account-values.ts` was
 * split out of `user.ts`: the API schemas need these values (`z.enum(Permission)`,
 * `z.enum(AbacScopes)`) while those two modules need the types the schemas infer. Keeping them where
 * they were would make each import a module that imports it back; here, both sides depend on this
 * module and nothing depends on them.
 *
 * Everything is re-exported from its original module, so existing import paths keep working — this
 * is a move, not a rename.
 */

export enum Permission {
    int_read = 'interaction:read',
    int_write = 'interaction:write',
    int_delete = 'interaction:delete',

    int_execute = 'interaction:execute',
    run_read = 'run:read',
    run_write = 'run:write',

    env_admin = 'environment:admin',

    app_manage = 'app:manage',
    project_admin = 'project:admin',
    project_integration_read = 'project:integration_read',
    project_settings_write = 'project:settings_write',

    api_key_create = 'api_key:create',
    api_key_read = 'api_key:read',
    api_key_secret_read = 'api_key:secret_read',
    api_key_update = 'api_key:update',
    api_key_delete = 'api_key:delete',

    account_read = 'account:read',
    account_write = 'account:write',
    account_admin = 'account:admin',
    manage_billing = 'account:billing',
    /** View cost and usage analytics */
    billing_read = 'billing:read',
    /** View account and project audit events. */
    audit_read = 'audit:read',
    account_member = 'account:member',

    content_read = 'content:read',
    content_read_all = 'content:read_all',
    content_write = 'content:write',
    content_delete = 'content:delete',
    content_admin = 'content:admin', //manage schemas
    content_superadmin = 'content:superadmin', // list all objects and collections

    workflow_read = 'workflow:read',
    workflow_run = 'workflow:run',
    workflow_admin = 'workflow:admin',
    workflow_superadmin = 'workflow:superadmin',

    agent_run_read = 'agent_run:read',

    task_read = 'task:read',
    task_manage = 'task:manage',

    iam_impersonate = 'iam:impersonate',

    /** whether the user has access to Sutdio App. */
    studio_access = 'studio:access',
}

export enum AccessControlResourceType {
    project = 'project',
    environment = 'environment',
    account = 'account',
    interaction = 'interaction',
    app = 'application',
    /**
     * Dynamic resource matching by property conditions at query time. The role
     * partitions (content, future tasks/etc.) determine which kind of object
     * the conditions match — selected via `AceConditions.scope`.
     *
     * NOTE: the string value remains `'content_set'` for backward compatibility
     * with stored ACEs and JWTs. The wire/DB rename to `'resource_set'` is a
     * separate concern (deferred). Until then, code reads
     * `AccessControlResourceType.resource_set` but the value on the wire stays
     * `'content_set'`.
     */
    resource_set = 'content_set',
}

export enum AccessControlPrincipalType {
    user = 'user',
    group = 'group',
    apikey = 'apikey',
    /** Dynamic principal matching by user/group properties at token time. */
    principal_set = 'principal_set',
}

/**
 * Kind of object a ResourceSet's `resource_props` matches at query time. Used
 * in `AceConditions.scope` (validated at runtime against this list) and as
 * the prefix in JWT `content_security` keys (e.g. `collection:read`).
 *
 * Each scope is owned by exactly one partition. When adding a new partition
 * (e.g. tasks), extend this list with the new scope(s) AND extend `RoleDomain`
 * with the new domain.
 */
export const AbacScopes = ['document', 'collection', 'agent_run', 'task'] as const;

/**
 * Logical grouping of roles by the service area that owns them. Declared as a
 * runtime list so the role schemas can publish it as an enum component; the
 * `RoleDomain` type is inferred from it in `roles/types.ts`.
 */
export const RoleDomains = ['system', 'content', 'agent_runs', 'tasks'] as const;
