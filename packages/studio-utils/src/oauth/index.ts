/** The standard OAuth claim plus the legacy Vertesia array emitted by older STS versions. */
export interface OAuthTokenScopeClaims {
    scope?: unknown;
    scopes?: unknown;
}

/** Decode the standard OAuth space-delimited `scope` claim. */
export function parseOAuthScope(scope: unknown): string[] {
    if (typeof scope !== 'string' || !scope.trim()) return [];
    return [...new Set(scope.trim().split(/\s+/).filter(Boolean))];
}

/**
 * Decode an OAuth token's scopes using the standard space-delimited claim.
 *
 * `scopes[]` is accepted only when `scope` is absent so a conflicting legacy
 * duplicate can never override the canonical claim.
 */
export function getOAuthTokenScopes(claims: unknown): string[] {
    if (typeof claims !== 'object' || claims === null) return [];
    const token = claims as OAuthTokenScopeClaims;
    if (token.scope !== undefined) {
        return parseOAuthScope(token.scope);
    }
    if (!Array.isArray(token.scopes)) return [];
    return [
        ...new Set(
            token.scopes.filter(
                (scope): scope is string => typeof scope === 'string' && scope.length > 0 && !/\s/.test(scope),
            ),
        ),
    ];
}
