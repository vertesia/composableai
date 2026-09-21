// Shared by the UI, public OAuth metadata, and published app package.
const CONFIG__OAUTH_SCOPES = ['openid', 'profile', 'offline_access'];

export const appOAuthScopes: string[] = CONFIG__OAUTH_SCOPES;

export function appOAuthPermissions(scopeOverride?: string): { scopes: string[]; offlineAccess: boolean } {
    const scopes = scopeOverride?.split(/\s+/).filter(Boolean) ?? appOAuthScopes;
    return { scopes, offlineAccess: scopes.includes('offline_access') };
}
