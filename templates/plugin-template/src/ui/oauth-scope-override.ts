/**
 * The OAuth scopes a standalone deployment asks for. Without an override the request names none, and the
 * authorization server grants the permissions declared on the app record in Vertesia.
 */
export function oauthScopeOverride(value?: string): { scopes?: string[]; offlineAccess: boolean } {
    const scopes = value?.split(/\s+/).filter(Boolean);
    if (!scopes?.length) return { offlineAccess: true };
    return { scopes, offlineAccess: scopes.includes('offline_access') };
}
