import { describe, it, expect } from 'vitest';
import {
    parseUrlScheme,
    needsResolution,
    mapSchemeToRoute,
} from './url-schemes.js';

describe('parseUrlScheme', () => {
    it('should parse artifact: URLs', () => {
        const result = parseUrlScheme('artifact:out/data.csv');

        expect(result.scheme).toBe('artifact');
        expect(result.path).toBe('out/data.csv');
    });

    it('should parse image: URLs', () => {
        const result = parseUrlScheme('image:charts/chart.png');

        expect(result.scheme).toBe('image');
        expect(result.path).toBe('charts/chart.png');
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

    it('should return standard for regular URLs', () => {
        const result = parseUrlScheme('https://example.com/file.csv');

        expect(result.scheme).toBe('standard');
        expect(result.path).toBe('https://example.com/file.csv');
    });

    it('should trim whitespace from paths', () => {
        const result = parseUrlScheme('artifact:  out/data.csv  ');

        expect(result.path).toBe('out/data.csv');
    });
});

describe('needsResolution', () => {
    it('should return true for artifact: URLs', () => {
        expect(needsResolution('artifact:out/data.csv')).toBe(true);
    });

    it('should return true for image: URLs', () => {
        expect(needsResolution('image:chart.png')).toBe(true);
    });

    it('should return false for store: URLs', () => {
        expect(needsResolution('store:abc123')).toBe(false);
    });

    it('should return false for standard URLs', () => {
        expect(needsResolution('https://example.com')).toBe(false);
    });
});

describe('mapSchemeToRoute', () => {
    it('should map store scheme to objects route', () => {
        const result = mapSchemeToRoute('store', 'abc123');

        expect(result).toBe('/store/objects/abc123');
    });

    it('should map document scheme to objects route', () => {
        const result = mapSchemeToRoute('document', 'doc-123');

        expect(result).toBe('/store/objects/doc-123');
    });

    it('should map collection scheme to collections route', () => {
        const result = mapSchemeToRoute('collection', 'my-collection');

        expect(result).toBe('/store/collections/my-collection');
    });

    it('should return null for artifact scheme', () => {
        const result = mapSchemeToRoute('artifact', 'out/data.csv');

        expect(result).toBeNull();
    });

    it('should return null for empty path', () => {
        const result = mapSchemeToRoute('store', '');

        expect(result).toBeNull();
    });
});
