import { describe, it, expect } from 'vitest';
import { applyParameterValues } from './VegaLiteChart';

describe('applyParameterValues', () => {
    it('should return spec unchanged when no parameterValues provided', () => {
        const spec = {
            params: [{ name: 'threshold', value: 50 }],
            mark: 'bar'
        };

        const result = applyParameterValues(spec, {});

        expect(result).toEqual(spec);
    });

    it('should return spec unchanged when parameterValues is empty object', () => {
        const spec = {
            params: [{ name: 'threshold', value: 50 }],
            mark: 'bar'
        };

        const result = applyParameterValues(spec, {});

        expect(result.params[0].value).toBe(50);
    });

    it('should update root-level param value', () => {
        const spec = {
            params: [
                { name: 'threshold', value: 50, bind: { input: 'range' } }
            ],
            mark: 'bar',
            data: { values: [] }
        };

        const result = applyParameterValues(spec, { threshold: 75 });

        expect(result.params[0].value).toBe(75);
        expect(result.params[0].name).toBe('threshold');
        expect(result.params[0].bind).toEqual({ input: 'range' });
    });

    it('should update multiple root-level params', () => {
        const spec = {
            params: [
                { name: 'threshold', value: 50 },
                { name: 'colorScheme', value: 'category10' },
                { name: 'showLabels', value: true }
            ],
            mark: 'bar'
        };

        const result = applyParameterValues(spec, {
            threshold: 100,
            colorScheme: 'tableau10'
        });

        expect(result.params[0].value).toBe(100);
        expect(result.params[1].value).toBe('tableau10');
        expect(result.params[2].value).toBe(true); // unchanged
    });

    it('should not modify original spec (immutability)', () => {
        const spec = {
            params: [{ name: 'threshold', value: 50 }],
            mark: 'bar'
        };

        applyParameterValues(spec, { threshold: 75 });

        expect(spec.params[0].value).toBe(50); // original unchanged
    });

    it('should handle spec without params array', () => {
        const spec = {
            mark: 'bar',
            data: { values: [] }
        };

        const result = applyParameterValues(spec, { threshold: 75 });

        expect(result).toEqual(spec);
    });

    it('should update params in vconcat views', () => {
        const spec = {
            data: { values: [] },
            vconcat: [
                {
                    params: [{ name: 'brushX', value: null }],
                    mark: 'bar'
                },
                {
                    params: [{ name: 'filterY', value: 'all' }],
                    mark: 'line'
                }
            ]
        };

        const result = applyParameterValues(spec, {
            brushX: [0, 100],
            filterY: 'category_a'
        });

        expect(result.vconcat[0].params[0].value).toEqual([0, 100]);
        expect(result.vconcat[1].params[0].value).toBe('category_a');
    });

    it('should update params in hconcat views', () => {
        const spec = {
            hconcat: [
                {
                    params: [{ name: 'leftParam', value: 1 }],
                    mark: 'point'
                },
                {
                    params: [{ name: 'rightParam', value: 2 }],
                    mark: 'bar'
                }
            ]
        };

        const result = applyParameterValues(spec, {
            leftParam: 10,
            rightParam: 20
        });

        expect(result.hconcat[0].params[0].value).toBe(10);
        expect(result.hconcat[1].params[0].value).toBe(20);
    });

    it('should update params in concat views', () => {
        const spec = {
            concat: [
                { params: [{ name: 'p1', value: 'a' }], mark: 'bar' },
                { params: [{ name: 'p2', value: 'b' }], mark: 'line' }
            ],
            columns: 2
        };

        const result = applyParameterValues(spec, { p1: 'x', p2: 'y' });

        expect(result.concat[0].params[0].value).toBe('x');
        expect(result.concat[1].params[0].value).toBe('y');
    });

    it('should update params in nested layer views', () => {
        const spec = {
            layer: [
                {
                    params: [{ name: 'layerParam', value: 'default' }],
                    mark: 'point'
                },
                {
                    mark: 'line'
                }
            ]
        };

        const result = applyParameterValues(spec, { layerParam: 'updated' });

        expect(result.layer[0].params[0].value).toBe('updated');
    });

    it('should update params in deeply nested vconcat > layer', () => {
        const spec = {
            vconcat: [
                {
                    layer: [
                        {
                            params: [{ name: 'deepParam', value: 0 }],
                            mark: 'point'
                        }
                    ]
                }
            ]
        };

        const result = applyParameterValues(spec, { deepParam: 999 });

        expect(result.vconcat[0].layer[0].params[0].value).toBe(999);
    });

    it('should handle both root and nested params', () => {
        const spec = {
            params: [{ name: 'rootParam', value: 'root' }],
            vconcat: [
                {
                    params: [{ name: 'nestedParam', value: 'nested' }],
                    mark: 'bar'
                }
            ]
        };

        const result = applyParameterValues(spec, {
            rootParam: 'updated_root',
            nestedParam: 'updated_nested'
        });

        expect(result.params[0].value).toBe('updated_root');
        expect(result.vconcat[0].params[0].value).toBe('updated_nested');
    });

    it('should apply only matching parameterValues (non-matching are ignored by applyParameterValues)', () => {
        // Note: Validation of non-matching params should be done before calling applyParameterValues
        // The applyParameterValues function just applies values, validation is separate
        const spec = {
            params: [{ name: 'existing', value: 10 }],
            mark: 'bar'
        };

        const result = applyParameterValues(spec, {
            nonexistent: 999,
            existing: 20
        });

        expect(result.params[0].value).toBe(20);
        expect(result.params.length).toBe(1);
    });

    it('should handle selection params (point/interval)', () => {
        const spec = {
            params: [
                {
                    name: 'brush',
                    select: { type: 'interval', encodings: ['x'] },
                    value: null
                }
            ],
            mark: 'area'
        };

        const result = applyParameterValues(spec, {
            brush: { x: [10, 50] }
        });

        expect(result.params[0].value).toEqual({ x: [10, 50] });
    });

    it('should handle recursive vconcat > vconcat', () => {
        const spec = {
            vconcat: [
                {
                    vconcat: [
                        {
                            params: [{ name: 'deeplyNested', value: 'original' }],
                            mark: 'bar'
                        }
                    ]
                }
            ]
        };

        const result = applyParameterValues(spec, { deeplyNested: 'changed' });

        expect(result.vconcat[0].vconcat[0].params[0].value).toBe('changed');
    });
});
