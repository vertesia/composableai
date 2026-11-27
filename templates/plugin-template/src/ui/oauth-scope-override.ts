/**
 * The OAuth scopes a standalone deployment asks for. Without an override it relies on the client's registered default
 * scopes, which for an installed app's client are the permissions declared on its app record in Vertesia. A client
 * registered with no default scopes gets sign-in only.
 */
export function oauthScopeOverride(value?: string): {
    scopes?: string[];
    useClientDefaultScopes?: boolean;
    offlineAccess: boolean;
} {
    const scopes = value?.split(/\s+/).filter(Boolean);
    if (!scopes?.length) return { useClientDefaultScopes: true, offlineAccess: true };
    return { scopes, offlineAccess: scopes.includes('offline_access') };
}
