import { Permission } from './access-control.js';

export const OAUTH_SCOPE_OPENID = 'openid';
export const OAUTH_SCOPE_PROFILE = 'profile';
export const OAUTH_SCOPE_OFFLINE_ACCESS = 'offline_access';
export const OAUTH_SCOPE_PROJECT_SWITCH = 'project_switch';

export const OAUTH_STANDARD_SCOPES = [OAUTH_SCOPE_OPENID, OAUTH_SCOPE_PROFILE, OAUTH_SCOPE_OFFLINE_ACCESS] as const;
export const OAUTH_PLATFORM_SCOPES = [OAUTH_SCOPE_PROJECT_SWITCH] as const;

export type OAuthStandardScope = (typeof OAUTH_STANDARD_SCOPES)[number];
export type OAuthPlatformScope = (typeof OAUTH_PLATFORM_SCOPES)[number];

const NON_OAUTH_PERMISSION_SCOPES = new Set<Permission>([
    Permission.api_key_secret_read,
    Permission.manage_billing,
    Permission.billing_read,
    Permission.iam_impersonate,
    Permission.studio_access,
]);
const OAUTH_PERMISSION_SCOPES = Object.values(Permission).filter((scope) => !NON_OAUTH_PERMISSION_SCOPES.has(scope));
const OAUTH_STANDARD_SCOPE_SET = new Set<string>(OAUTH_STANDARD_SCOPES);
const OAUTH_PLATFORM_SCOPE_SET = new Set<string>(OAUTH_PLATFORM_SCOPES);
const OAUTH_PERMISSION_SCOPE_SET = new Set<string>(OAUTH_PERMISSION_SCOPES);
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const OAUTH_PROJECT_BINDING_SCOPE_PREFIX = 'project:';

export function getOAuthPermissionScopes(): Permission[] {
    return [...OAUTH_PERMISSION_SCOPES];
}

export function isOAuthStandardScope(scope: string): scope is OAuthStandardScope {
    return OAUTH_STANDARD_SCOPE_SET.has(scope);
}

export function isOAuthPlatformScope(scope: string): scope is OAuthPlatformScope {
    return OAUTH_PLATFORM_SCOPE_SET.has(scope);
}

export function isOAuthPermissionScope(scope: string): scope is Permission {
    return OAUTH_PERMISSION_SCOPE_SET.has(scope);
}

export function isOAuthSupportedScope(scope: string): boolean {
    return isOAuthStandardScope(scope) || isOAuthPlatformScope(scope) || isOAuthPermissionScope(scope);
}

export function isOAuthProjectBindingScope(scope: string): boolean {
    if (!scope.startsWith(OAUTH_PROJECT_BINDING_SCOPE_PREFIX)) {
        return false;
    }
    return OBJECT_ID_PATTERN.test(scope.slice(OAUTH_PROJECT_BINDING_SCOPE_PREFIX.length));
}

export function createOAuthProjectBindingScope(projectId: string): string {
    return `${OAUTH_PROJECT_BINDING_SCOPE_PREFIX}${projectId}`;
}

export function hasOAuthOpenIdScope(scopes: readonly string[]): boolean {
    return scopes.includes(OAUTH_SCOPE_OPENID);
}

export function hasOAuthProfileScope(scopes: readonly string[]): boolean {
    return scopes.includes(OAUTH_SCOPE_PROFILE);
}

export function hasOAuthOfflineAccessScope(scopes: readonly string[]): boolean {
    return scopes.includes(OAUTH_SCOPE_OFFLINE_ACCESS);
}

export function hasOAuthProjectSwitchScope(scopes: readonly string[]): boolean {
    return scopes.includes(OAUTH_SCOPE_PROJECT_SWITCH);
}

export function getOAuthScopesWithProfileDependency(scopes: readonly string[]): string[] {
    if (!hasOAuthOpenIdScope(scopes)) {
        return scopes.filter((scope) => scope !== OAUTH_SCOPE_PROFILE);
    }
    return [...scopes];
}

export function extractOAuthPermissionScopes(scopes: readonly string[]): Permission[] {
    return scopes.filter(isOAuthPermissionScope);
}
