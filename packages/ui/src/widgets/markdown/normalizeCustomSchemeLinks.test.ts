import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';
import { normalizeCustomSchemeLinks } from './normalizeCustomSchemeLinks';

function renderMarkdownToHtml(markdown: string): string {
    return renderToStaticMarkup(
        React.createElement(Markdown, { remarkPlugins: [remarkGfm], urlTransform: (url: string) => url }, markdown),
    );
}

describe('normalizeCustomSchemeLinks', () => {
    it('proves baseline parser behavior: custom link with spaces is not rendered as an anchor before normalization', () => {
        const input = '[Download PDF](artifact:out/INVOICE 2025-001.pdf)';
        const beforeHtml = renderMarkdownToHtml(input);
        const afterHtml = renderMarkdownToHtml(normalizeCustomSchemeLinks(input));

        expect(beforeHtml).not.toContain('<a ');
        expect(afterHtml).toContain('<a ');
    });

    it('wraps artifact destinations so links with spaces remain valid markdown', () => {
        const input = '[Download PDF](artifact:out/INVOICE 2025-001.pdf)';
        const output = normalizeCustomSchemeLinks(input);
        expect(output).toBe('[Download PDF](<artifact:out/INVOICE 2025-001.pdf>)');
    });

    it('preserves optional markdown link titles', () => {
        const input = '![Invoice](artifact:out/INVOICE 2025-001.pdf "Invoice PDF")';
        const output = normalizeCustomSchemeLinks(input);
        expect(output).toBe('![Invoice](<artifact:out/INVOICE 2025-001.pdf> "Invoice PDF")');
    });

    it('leaves already bracketed custom links unchanged', () => {
        const input = '[Download](<artifact:out/INVOICE 2025-001.pdf>)';
        const output = normalizeCustomSchemeLinks(input);
        expect(output).toBe(input);
    });

    it('does not modify standard urls', () => {
        const input = '[Docs](https://example.com/some path)';
        const output = normalizeCustomSchemeLinks(input);
        expect(output).toBe(input);
    });

    it('normalizes custom links inside table cells', () => {
        const input = '| PDF |\n| --- |\n| [Download](artifact:out/INVOICE 2025-001.pdf) |';
        const output = normalizeCustomSchemeLinks(input);
        expect(output).toContain('[Download](<artifact:out/INVOICE 2025-001.pdf>)');
    });

    it('proves table-cell behavior: no anchor before normalization, anchor after normalization', () => {
        const input = '| PDF |\n| --- |\n| [Download](artifact:out/INVOICE 2025-001.pdf) |';
        const beforeHtml = renderMarkdownToHtml(input);
        const afterHtml = renderMarkdownToHtml(normalizeCustomSchemeLinks(input));

        expect(beforeHtml).toContain('<table>');
        expect(beforeHtml).not.toContain('<a ');
        expect(afterHtml).toContain('<table>');
        expect(afterHtml).toContain('<a ');
    });

    it('does not rewrite inline code or fenced code blocks', () => {
        const input = [
            '`[inline](artifact:out/INVOICE 2025-001.pdf)`',
            '',
            '```md',
            '[fenced](artifact:out/INVOICE 2025-001.pdf)',
            '```',
            '',
            '[regular](artifact:out/INVOICE 2025-001.pdf)',
        ].join('\n');

        const output = normalizeCustomSchemeLinks(input);

        expect(output).toContain('`[inline](artifact:out/INVOICE 2025-001.pdf)`');
        expect(output).toContain('[fenced](artifact:out/INVOICE 2025-001.pdf)');
        expect(output).toContain('[regular](<artifact:out/INVOICE 2025-001.pdf>)');
    });

    it('normalizes each custom scheme', () => {
        expect(normalizeCustomSchemeLinks('[a](store:x y)')).toBe('[a](<store:x y>)');
        expect(normalizeCustomSchemeLinks('[a](collection:x y)')).toBe('[a](<collection:x y>)');
        expect(normalizeCustomSchemeLinks('[a](document://x y)')).toBe('[a](<document://x y>)');
        expect(normalizeCustomSchemeLinks('![a](image:x y)')).toBe('![a](<image:x y>)');
    });

    // Regression guard for CodeQL js/polynomial-redos: excluding `[` from the
    // link-text/destination classes makes a run of '[' (or '[](image:' groups)
    // with no closing delimiter linear instead of quadratic.
    it('runs in linear time on pathological bracket runs', () => {
        const inputs = ['['.repeat(100_000), '[](image:'.repeat(100_000)];
        for (const evil of inputs) {
            const start = performance.now();
            normalizeCustomSchemeLinks(evil);
            expect(performance.now() - start).toBeLessThan(1000);
        }
    });
});
