/**
 * Fuzzy matching utilities for key suggestions
 * Uses Levenshtein distance for finding similar keys
 */
/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a, b) {
    const matrix = [];
    // Initialize first column
    for (let i = 0; i <= a.length; i++) {
        matrix[i] = [i];
    }
    // Initialize first row
    for (let j = 0; j <= b.length; j++) {
        matrix[0][j] = j;
    }
    // Fill in the rest of the matrix
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, // deletion
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return matrix[a.length][b.length];
}
/**
 * Find the closest matching key from a list of valid keys
 * @param input - The key that wasn't found
 * @param validKeys - List of valid keys to search
 * @param maxDistance - Maximum edit distance to consider (default: 3)
 * @returns The closest key, or undefined if none are close enough
 */
export function findClosestKey(input, validKeys, maxDistance = 3) {
    if (validKeys.length === 0)
        return undefined;
    const inputLower = input.toLowerCase();
    let bestMatch;
    let bestDistance = Infinity;
    for (const key of validKeys) {
        const keyLower = key.toLowerCase();
        // Exact case-insensitive match
        if (inputLower === keyLower) {
            return key;
        }
        // Check if input is a substring or key is a substring
        if (inputLower.includes(keyLower) || keyLower.includes(inputLower)) {
            const distance = Math.abs(inputLower.length - keyLower.length);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = key;
            }
            continue;
        }
        // Levenshtein distance
        const distance = levenshteinDistance(inputLower, keyLower);
        if (distance < bestDistance && distance <= maxDistance) {
            bestDistance = distance;
            bestMatch = key;
        }
    }
    return bestMatch;
}
/**
 * Find multiple similar keys, sorted by relevance
 * @param input - The key that wasn't found
 * @param validKeys - List of valid keys to search
 * @param maxResults - Maximum number of suggestions (default: 3)
 * @returns Array of similar keys
 */
export function findSimilarKeys(input, validKeys, maxResults = 3) {
    if (validKeys.length === 0)
        return [];
    const inputLower = input.toLowerCase();
    const scored = validKeys
        .map(key => ({
        key,
        distance: levenshteinDistance(inputLower, key.toLowerCase())
    }))
        .filter(({ distance }) => distance <= 4) // Filter out very different keys
        .sort((a, b) => a.distance - b.distance);
    return scored.slice(0, maxResults).map(({ key }) => key);
}
//# sourceMappingURL=fuzzyMatch.js.map