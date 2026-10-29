/** Decode the standard OAuth space-delimited `scope` claim. */
export function parseOAuthScope(scope: unknown): string[] {
    if (typeof scope !== 'string' || !scope.trim()) return [];
    return [...new Set(scope.trim().split(/\s+/).filter(Boolean))];
}
