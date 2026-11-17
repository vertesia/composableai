import { ACCOUNT_SCOPED_PERMISSIONS, Permission } from './access-control-values.js';

export const OAUTH_SCOPE_OPENID = 'openid';
export const OAUTH_SCOPE_PROFILE = 'profile';
export const OAUTH_SCOPE_OFFLINE_ACCESS = 'offline_access';
export const OAUTH_SCOPE_PROJECT_SWITCH = 'project_switch';

export const OAUTH_STANDARD_SCOPES = [OAUTH_SCOPE_OPENID, OAUTH_SCOPE_PROFILE, OAUTH_SCOPE_OFFLINE_ACCESS] as const;

/**
 * Permissions that are never grantable as an OAuth scope: they administer persistent credentials,
 * hand out secret material, or are internal to the platform's own consoles.
 */
const NON_OAUTH_PERMISSION_SCOPES = new Set<Permission>([
    ...ACCOUNT_SCOPED_PERMISSIONS,
    Permission.schedule_delegate,
    Permission.api_key_create,
    Permission.api_key_update,
    Permission.api_key_delete,
    Permission.api_key_secret_read,
    Permission.manage_billing,
    Permission.billing_read,
    Permission.iam_impersonate,
    Permission.studio_access,
    // Not an OAuth scope yet: an MCP server that advertises it and a token server that predates it would refuse
    // every client that requests all the advertised scopes. An OAuth client with `project:settings_write` already
    // manages content sources.
    Permission.content_source_manage,
]);

const OAUTH_PERMISSION_SCOPES = Object.values(Permission).filter((scope) => !NON_OAUTH_PERMISSION_SCOPES.has(scope));

/** The permissions a client may request as OAuth scopes. */
export function getOAuthPermissionScopes(): Permission[] {
    return [...OAUTH_PERMISSION_SCOPES];
}
