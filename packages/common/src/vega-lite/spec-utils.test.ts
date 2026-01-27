import { describe, it, expect } from 'vitest';
import {
    findArtifactReferences,
    replaceArtifactData,
    fixVegaLiteSelectionParams,
    applyParameterValues,
} from './spec-utils.js';

describe('findArtifactReferences', () => {
    it('should find artifact reference in root data.url', () => {
        const spec = {
            data: { url: 'artifact:out/data.csv' },
            mark: 'bar',
        };

        const refs = findArtifactReferences(spec);

        expect(refs).toHaveLength(1);
        expect(refs[0].artifactPath).toBe('out/data.csv');
        expect(refs[0].path).toEqual(['data']);
    });

    it('should find artifact references in nested vconcat', () => {
        const spec = {
            vconcat: [
                { data: { url: 'artifact:out/chart1.csv' }, mark: 'bar' },
                { data: { url: 'artifact:out/chart2.csv' }, mark: 'line' },
            ],
        };

        const refs = findArtifactReferences(spec);

        expect(refs).toHaveLength(2);
        expect(refs[0].artifactPath).toBe('out/chart1.csv');
        expect(refs[1].artifactPath).toBe('out/chart2.csv');
    });

    it('should return empty array for non-artifact URLs', () => {
        const spec = {
            data: { url: 'https://example.com/data.csv' },
            mark: 'bar',
        };

        const refs = findArtifactReferences(spec);

        expect(refs).toHaveLength(0);
    });

    it('should return empty array for inline data', () => {
        const spec = {
            data: { values: [{ a: 1 }, { a: 2 }] },
            mark: 'bar',
        };

        const refs = findArtifactReferences(spec);

        expect(refs).toHaveLength(0);
    });
});

describe('replaceArtifactData', () => {
    it('should replace artifact URL with inline data', () => {
        const spec = {
            data: { url: 'artifact:out/data.csv' },
            mark: 'bar',
        };

        const resolvedData = new Map<string, unknown[]>();
        resolvedData.set('data', [{ a: 1 }, { a: 2 }]);

        const result = replaceArtifactData(spec, resolvedData);

        expect(result.data).toEqual({ values: [{ a: 1 }, { a: 2 }] });
        expect((result.data as Record<string, unknown>).url).toBeUndefined();
    });

    it('should not modify original spec (immutability)', () => {
        const spec = {
            data: { url: 'artifact:out/data.csv' },
            mark: 'bar',
        };

        const resolvedData = new Map<string, unknown[]>();
        resolvedData.set('data', [{ a: 1 }]);

        replaceArtifactData(spec, resolvedData);

        expect((spec.data as Record<string, unknown>).url).toBe('artifact:out/data.csv');
    });
});

describe('fixVegaLiteSelectionParams', () => {
    it('should return spec unchanged for non-concatenated views', () => {
        const spec = {
            params: [{ name: 'brush', select: { type: 'interval' } }],
            mark: 'bar',
        };

        const result = fixVegaLiteSelectionParams(spec);

        expect(result.params).toHaveLength(1);
    });

    it('should move selection params to first view in vconcat', () => {
        const spec = {
            params: [{ name: 'brush', select: { type: 'interval' } }],
            vconcat: [
                { mark: 'bar', encoding: { x: { field: 'a' } } },
                { mark: 'line', encoding: { x: { field: 'b' } } },
            ],
        };

        const result = fixVegaLiteSelectionParams(spec);

        expect(result.params).toBeUndefined();
        expect((result.vconcat as Record<string, unknown>[])[0].params).toHaveLength(1);
    });

    it('should not modify original spec (immutability)', () => {
        const spec = {
            params: [{ name: 'brush', select: { type: 'interval' } }],
            vconcat: [{ mark: 'bar' }],
        };

        fixVegaLiteSelectionParams(spec);

        expect(spec.params).toHaveLength(1);
    });
});

describe('applyParameterValues', () => {
    it('should return spec unchanged when no parameterValues provided', () => {
        const spec = {
            params: [{ name: 'threshold', value: 50 }],
            mark: 'bar',
        };

        const result = applyParameterValues(spec, {});

        expect(result).toEqual(spec);
    });

    it('should update root-level param value', () => {
        const spec = {
            params: [{ name: 'threshold', value: 50 }],
            mark: 'bar',
        };

        const result = applyParameterValues(spec, { threshold: 75 });

        expect((result.params as Record<string, unknown>[])[0].value).toBe(75);
    });

    it('should update params in vconcat views', () => {
        const spec = {
            vconcat: [
                { params: [{ name: 'p1', value: 1 }], mark: 'bar' },
                { params: [{ name: 'p2', value: 2 }], mark: 'line' },
            ],
        };

        const result = applyParameterValues(spec, { p1: 10, p2: 20 });

        const vconcat = result.vconcat as Record<string, unknown>[];
        expect((vconcat[0].params as Record<string, unknown>[])[0].value).toBe(10);
        expect((vconcat[1].params as Record<string, unknown>[])[0].value).toBe(20);
    });

    it('should not modify original spec (immutability)', () => {
        const spec = {
            params: [{ name: 'threshold', value: 50 }],
            mark: 'bar',
        };

        applyParameterValues(spec, { threshold: 75 });

        expect((spec.params as Record<string, unknown>[])[0].value).toBe(50);
    });
});
