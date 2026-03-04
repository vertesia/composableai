import { describe, it, expect } from 'vitest';
import { parseUrlScheme, mapSchemeToRoute } from './useResolvedUrl';

describe('parseUrlScheme', () => {
    it('should parse artifact: URLs', () => {
        const result = parseUrlScheme('artifact:out/data.csv');
        expect(result.scheme).toBe('artifact');
        expect(result.path).toBe('out/data.csv');
    });

    it('should parse image: URLs', () => {
        const result = parseUrlScheme('image:photos/test.png');
        expect(result.scheme).toBe('image');
        expect(result.path).toBe('photos/test.png');
    });

    it('should parse store: URLs', () => {
        const result = parseUrlScheme('store:abc123');
        expect(result.scheme).toBe('store');
        expect(result.path).toBe('abc123');
    });

    it('should parse document:// URLs', () => {
        const result = parseUrlScheme('document://doc-id-123');
        expect(result.scheme).toBe('document');
        expect(result.path).toBe('doc-id-123');
    });

    it('should parse collection: URLs', () => {
        const result = parseUrlScheme('collection:my-collection');
        expect(result.scheme).toBe('collection');
        expect(result.path).toBe('my-collection');
    });

    it('should parse standard URLs', () => {
        const result = parseUrlScheme('https://example.com/page');
        expect(result.scheme).toBe('standard');
        expect(result.path).toBe('https://example.com/page');
    });

    it('should parse relative URLs as standard', () => {
        const result = parseUrlScheme('/path/to/page');
        expect(result.scheme).toBe('standard');
        expect(result.path).toBe('/path/to/page');
    });

    it('should trim whitespace from paths', () => {
        const result = parseUrlScheme('artifact:  path/with/spaces  ');
        expect(result.path).toBe('path/with/spaces');
    });

    it('should handle empty URLs', () => {
        const result = parseUrlScheme('');
        expect(result.scheme).toBe('standard');
        expect(result.path).toBe('');
    });
});

describe('mapSchemeToRoute', () => {
    it('should map store: to /store/objects/', () => {
        const result = mapSchemeToRoute('store', 'abc123');
        expect(result).toBe('/store/objects/abc123');
    });

    it('should map document: to /store/objects/', () => {
        const result = mapSchemeToRoute('document', 'doc-id');
        expect(result).toBe('/store/objects/doc-id');
    });

    it('should map collection: to /store/collections/', () => {
        const result = mapSchemeToRoute('collection', 'my-collection');
        expect(result).toBe('/store/collections/my-collection');
    });

    it('should return null for artifact: scheme', () => {
        const result = mapSchemeToRoute('artifact', 'path/to/file');
        expect(result).toBeNull();
    });

    it('should return null for image: scheme', () => {
        const result = mapSchemeToRoute('image', 'path/to/image');
        expect(result).toBeNull();
    });

    it('should return null for standard scheme', () => {
        const result = mapSchemeToRoute('standard', 'https://example.com');
        expect(result).toBeNull();
    });

    it('should return null for empty path', () => {
        const result = mapSchemeToRoute('store', '');
        expect(result).toBeNull();
    });
});
