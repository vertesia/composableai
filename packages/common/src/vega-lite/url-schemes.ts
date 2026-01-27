/**
 * URL Scheme Utilities
 *
 * Parse and handle custom URL schemes used in Vertesia:
 * - artifact: - workflow artifacts
 * - image: - stored images
 * - store: - store objects
 * - document:// - documents
 * - collection: - collections
 */

export type UrlScheme =
    | 'artifact'
    | 'image'
    | 'store'
    | 'document'
    | 'collection'
    | 'standard';

export interface ParsedUrl {
    /** The detected URL scheme */
    scheme: UrlScheme;
    /** The path portion after the scheme prefix */
    path: string;
}

/**
 * Parse a URL and return its scheme and path.
 *
 * @example
 * parseUrlScheme('artifact:out/data.csv')
 * // { scheme: 'artifact', path: 'out/data.csv' }
 *
 * parseUrlScheme('https://example.com/file.csv')
 * // { scheme: 'standard', path: 'https://example.com/file.csv' }
 */
export function parseUrlScheme(rawUrl: string): ParsedUrl {
    if (rawUrl.startsWith('artifact:')) {
        return { scheme: 'artifact', path: rawUrl.slice(9).trim() };
    }
    if (rawUrl.startsWith('image:')) {
        return { scheme: 'image', path: rawUrl.slice(6).trim() };
    }
    if (rawUrl.startsWith('store:')) {
        return { scheme: 'store', path: rawUrl.slice(6).trim() };
    }
    if (rawUrl.startsWith('document://')) {
        return { scheme: 'document', path: rawUrl.slice(11).trim() };
    }
    if (rawUrl.startsWith('collection:')) {
        return { scheme: 'collection', path: rawUrl.slice(11).trim() };
    }
    return { scheme: 'standard', path: rawUrl };
}

/**
 * Check if a URL uses a custom Vertesia scheme that needs resolution.
 */
export function needsResolution(rawUrl: string): boolean {
    const { scheme } = parseUrlScheme(rawUrl);
    return scheme === 'artifact' || scheme === 'image';
}

/**
 * Map internal URL schemes to application routes (for client-side navigation).
 * Returns null if the scheme doesn't map to a route.
 */
export function mapSchemeToRoute(scheme: UrlScheme, path: string): string | null {
    switch (scheme) {
        case 'store':
            return path ? `/store/objects/${path}` : null;
        case 'document':
            return path ? `/store/objects/${path}` : null;
        case 'collection':
            return path ? `/store/collections/${path}` : null;
        default:
            return null;
    }
}
