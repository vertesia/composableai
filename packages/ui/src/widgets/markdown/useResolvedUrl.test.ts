import { describe, expect, it } from 'vitest';
import { parseUrlScheme } from './useResolvedUrl';

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

    it('should strip the // authority from collection:// URLs', () => {
        const result = parseUrlScheme('collection://my-collection');
        expect(result.scheme).toBe('collection');
        expect(result.path).toBe('my-collection');
    });

    it('should strip the // authority from store:// URLs', () => {
        const result = parseUrlScheme('store://abc123');
        expect(result.scheme).toBe('store');
        expect(result.path).toBe('abc123');
    });

    it('should parse document: URLs without the // authority', () => {
        const result = parseUrlScheme('document:doc-id-123');
        expect(result.scheme).toBe('document');
        expect(result.path).toBe('doc-id-123');
    });

    it('should normalize collection:// to its resource id', () => {
        const { scheme, path } = parseUrlScheme('collection://my-collection');
        expect(scheme).toBe('collection');
        expect(path).toBe('my-collection');
    });

    it.each([
        ['interaction:int-1', 'interaction', 'int-1'],
        ['prompt:prm-1', 'prompt', 'prm-1'],
        ['agent:agt-1', 'agent', 'agt-1'],
        ['workflow:wf-1', 'workflow', 'wf-1'],
        ['process:proc-1', 'process', 'proc-1'],
        ['run:run-1', 'run', 'run-1'],
    ])('should parse %s as a route scheme', (raw, scheme, path) => {
        const result = parseUrlScheme(raw);
        expect(result.scheme).toBe(scheme);
        expect(result.path).toBe(path);
    });

    it('should strip the // authority from interaction:// URLs', () => {
        const result = parseUrlScheme('interaction://int-1');
        expect(result.scheme).toBe('interaction');
        expect(result.path).toBe('int-1');
    });

    it('should parse standard URLs', () => {
        const result = parseUrlScheme('https://example.com/page');
        expect(result.scheme).toBe('standard');
        expect(result.path).toBe('https://example.com/page');
    });

    it('should treat an unknown scheme as standard', () => {
        const result = parseUrlScheme('mailto:user@example.com');
        expect(result.scheme).toBe('standard');
        expect(result.path).toBe('mailto:user@example.com');
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
