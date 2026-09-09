import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JSONCode, renderJsonLine } from './JSONCode';

function renderJson(data: unknown): string {
    return renderToStaticMarkup(React.createElement(JSONCode, { data }));
}

describe('JSONCode', () => {
    it('colors keys, string values, literals and numbers distinctly', () => {
        const html = renderJson({ name: 'value', count: 42, flag: true, missing: null });
        // key (string immediately followed by a colon)
        expect(html).toContain('<span class="text-info">&quot;name&quot;</span>');
        // string value (string NOT followed by a colon)
        expect(html).toContain('<span class="text-success">&quot;value&quot;</span>');
        // number
        expect(html).toContain('<span class="text-attention">42</span>');
        // literals
        expect(html).toContain('<span class="text-primary">true</span>');
        expect(html).toContain('<span class="text-primary">null</span>');
    });

    it('treats a string with escaped quotes as a single token', () => {
        const html = renderJson({ esc: 'a"b' });
        expect(html).toContain('<span class="text-success">&quot;a\\&quot;b&quot;</span>');
    });

    it('renders invalid JSON gracefully', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => renderJson(circular)).not.toThrow();
    });
});

describe('renderJsonLine', () => {
    it('classifies a key/value pair', () => {
        const html = renderToStaticMarkup(React.createElement('pre', null, renderJsonLine('  "k": "v",')));
        expect(html).toContain('<span class="text-info">&quot;k&quot;</span>');
        expect(html).toContain('<span class="text-success">&quot;v&quot;</span>');
    });

    // Regression guard for CodeQL js/polynomial-redos: collapsing the duplicated
    // (key)|(value) string alternatives and making the closing quote optional makes a
    // malformed unterminated string linear instead of quadratic under the global scan.
    it('runs in linear time on a malformed unterminated string', () => {
        const evil = `"${'\\"'.repeat(100_000)}`;
        const start = performance.now();
        renderJsonLine(evil);
        expect(performance.now() - start).toBeLessThan(1000);
    });
});
