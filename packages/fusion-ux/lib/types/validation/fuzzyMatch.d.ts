/**
 * Fuzzy matching utilities for key suggestions
 * Uses Levenshtein distance for finding similar keys
 */
/**
 * Calculate Levenshtein distance between two strings
 */
export declare function levenshteinDistance(a: string, b: string): number;
/**
 * Find the closest matching key from a list of valid keys
 * @param input - The key that wasn't found
 * @param validKeys - List of valid keys to search
 * @param maxDistance - Maximum edit distance to consider (default: 3)
 * @returns The closest key, or undefined if none are close enough
 */
export declare function findClosestKey(input: string, validKeys: string[], maxDistance?: number): string | undefined;
/**
 * Find multiple similar keys, sorted by relevance
 * @param input - The key that wasn't found
 * @param validKeys - List of valid keys to search
 * @param maxResults - Maximum number of suggestions (default: 3)
 * @returns Array of similar keys
 */
export declare function findSimilarKeys(input: string, validKeys: string[], maxResults?: number): string[];
//# sourceMappingURL=fuzzyMatch.d.ts.map