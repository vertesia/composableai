import { describe, it, expect } from 'vitest';
import { createDefaultCodeBlockHandlers } from './codeBlockHandlers';

describe('createDefaultCodeBlockHandlers', () => {
    it('should return handlers for all expected languages', () => {
        const handlers = createDefaultCodeBlockHandlers();

        expect(handlers).toHaveProperty('chart');
        expect(handlers).toHaveProperty('vega-lite');
        expect(handlers).toHaveProperty('mermaid');
        expect(handlers).toHaveProperty('proposal');
        expect(handlers).toHaveProperty('askuser');
    });

    it('should use dedicated handler for vega-lite code blocks', () => {
        const handlers = createDefaultCodeBlockHandlers();
        // vega-lite code blocks use a dedicated handler that always treats content as Vega-Lite
        expect(handlers['vega-lite']).not.toBe(handlers['chart']);
        expect(handlers['vega-lite']).toBe(handlers['vegalite']);
    });

    it('should use same handler for proposal and askuser', () => {
        const handlers = createDefaultCodeBlockHandlers();
        expect(handlers['proposal']).toBe(handlers['askuser']);
    });
});

// Test the chart JSON parsing logic (extracted as pure functions for testing)
describe('Chart JSON parsing', () => {
    const parseChartJson = (code: string): Record<string, unknown> | null => {
        try {
            let raw = code.trim();
            const jsonStart = raw.indexOf('{');
            const jsonEnd = raw.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                raw = raw.slice(jsonStart, jsonEnd + 1);
            }
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };

    const detectChartLibrary = (spec: Record<string, unknown>): 'vega-lite' | null => {
        const hasVegaSchema = typeof spec.$schema === 'string' && spec.$schema.includes('vega');
        const isExplicitVegaLite = spec.library === 'vega-lite' && 'spec' in spec;
        if (hasVegaSchema || isExplicitVegaLite) {
            return 'vega-lite';
        }
        return null;
    };

    describe('parseChartJson', () => {
        it('should parse valid JSON', () => {
            const result = parseChartJson('{"chart": "bar", "data": []}');
            expect(result).toEqual({ chart: 'bar', data: [] });
        });

        it('should handle JSON with extra content before', () => {
            const result = parseChartJson('Some text before {"chart": "bar"}');
            expect(result).toEqual({ chart: 'bar' });
        });

        it('should handle JSON with extra content after', () => {
            const result = parseChartJson('{"chart": "bar"} some text after');
            expect(result).toEqual({ chart: 'bar' });
        });

        it('should return null for invalid JSON', () => {
            const result = parseChartJson('not valid json');
            expect(result).toBeNull();
        });

        it('should handle whitespace', () => {
            const result = parseChartJson('  \n  {"chart": "bar"}  \n  ');
            expect(result).toEqual({ chart: 'bar' });
        });
    });

    describe('detectChartLibrary', () => {
        it('should detect Vega-Lite by $schema', () => {
            const spec = {
                $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
                mark: 'bar',
                data: { values: [] },
            };
            expect(detectChartLibrary(spec)).toBe('vega-lite');
        });

        it('should detect explicit Vega-Lite with library field', () => {
            const spec = {
                library: 'vega-lite',
                spec: { mark: 'bar' },
            };
            expect(detectChartLibrary(spec)).toBe('vega-lite');
        });

        it('should return null for non-chart spec', () => {
            const spec = { foo: 'bar' };
            expect(detectChartLibrary(spec)).toBeNull();
        });

        it('should return null for legacy chart format', () => {
            const spec = {
                chart: 'bar',
                data: [{ x: 1, y: 2 }],
            };
            expect(detectChartLibrary(spec)).toBeNull();
        });
    });
});

// Test proposal JSON parsing
describe('Proposal JSON parsing', () => {
    const parseProposalSpec = (code: string) => {
        try {
            const raw = code.trim();
            const spec = JSON.parse(raw);
            if (!spec.options || (!spec.question && !spec.title)) {
                return null;
            }
            return {
                question: spec.question || spec.title || '',
                description: spec.description,
                options: Array.isArray(spec.options)
                    ? spec.options.map((opt: any) => ({
                        id: opt.id || opt.value || '',
                        label: opt.label || '',
                        description: opt.description,
                    }))
                    : undefined,
                allowFreeResponse: spec.allowFreeResponse ?? spec.multiple,
            };
        } catch {
            return null;
        }
    };

    it('should parse valid proposal with question', () => {
        const spec = JSON.stringify({
            question: 'Choose an option',
            options: [
                { id: '1', label: 'Option 1' },
                { id: '2', label: 'Option 2' },
            ],
        });

        const result = parseProposalSpec(spec);
        expect(result?.question).toBe('Choose an option');
        expect(result?.options).toHaveLength(2);
    });

    it('should parse valid proposal with title (fallback)', () => {
        const spec = JSON.stringify({
            title: 'Choose wisely',
            options: [{ id: '1', label: 'Option 1' }],
        });

        const result = parseProposalSpec(spec);
        expect(result?.question).toBe('Choose wisely');
    });

    it('should return null for spec without options', () => {
        const spec = JSON.stringify({ question: 'No options' });
        expect(parseProposalSpec(spec)).toBeNull();
    });

    it('should return null for spec without question or title', () => {
        const spec = JSON.stringify({ options: [{ id: '1', label: 'Option' }] });
        expect(parseProposalSpec(spec)).toBeNull();
    });

    it('should handle allowFreeResponse flag', () => {
        const spec = JSON.stringify({
            question: 'Test',
            options: [{ id: '1', label: 'Option' }],
            allowFreeResponse: true,
        });

        const result = parseProposalSpec(spec);
        expect(result?.allowFreeResponse).toBe(true);
    });

    it('should fallback to multiple flag for allowFreeResponse', () => {
        const spec = JSON.stringify({
            question: 'Test',
            options: [{ id: '1', label: 'Option' }],
            multiple: true,
        });

        const result = parseProposalSpec(spec);
        expect(result?.allowFreeResponse).toBe(true);
    });

    it('should extract id from value if id not present', () => {
        const spec = JSON.stringify({
            question: 'Test',
            options: [{ value: 'opt1', label: 'Option' }],
        });

        const result = parseProposalSpec(spec);
        expect(result?.options?.[0].id).toBe('opt1');
    });
});
