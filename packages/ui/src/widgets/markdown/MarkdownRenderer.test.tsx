// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { visit } from 'unist-util-visit';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer.js';

afterEach(cleanup);

/**
 * KaTeX loads lazily and stays cached for the module, so math first renders as `<code>` and later as
 * `.katex`. Wait for KaTeX so the assertion does not depend on which earlier test loaded it.
 */
async function renderedTex(container: HTMLElement, count: number): Promise<string[]> {
    await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(count));
    return Array.from(container.querySelectorAll('.katex annotation'), (node) => node.textContent ?? '');
}

describe('MarkdownRenderer colon text', () => {
    it('preserves times in headings and agenda lists without inserting block elements', () => {
        const { container } = render(
            <MarkdownRenderer>
                {
                    '**DAY 1 — 9:00 a.m. to 4:30 p.m.**\n\n1. 9:00–9:15 (15 min): Welcome\n2. 9:15–9:45 (30 min): Foundations'
                }
            </MarkdownRenderer>,
        );

        expect(container.querySelector('strong')?.textContent).toBe('DAY 1 — 9:00 a.m. to 4:30 p.m.');
        expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            '9:00–9:15 (15 min): Welcome',
            '9:15–9:45 (30 min): Foundations',
        ]);
        expect(container.querySelector('li div, strong div')).toBeNull();
    });

    it('preserves minutes in table cells', () => {
        render(<MarkdownRenderer>{'| Start | End |\n| --- | --- |\n| 9:15 | 10:30 |'}</MarkdownRenderer>);

        expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['9:15', '10:30']);
    });

    it.each([':unknown[label]{key="value"}', ':note[inline]', ':00', ':unknown[a :nested[b]]'])(
        'preserves unsupported inline syntax exactly: %s',
        (text) => {
            const { container } = render(<MarkdownRenderer>{`Before ${text} after`}</MarkdownRenderer>);
            expect(container.querySelector('p')?.textContent).toBe(`Before ${text} after`);
        },
    );

    it('continues to render block callouts, generic containers and page breaks', () => {
        const { container } = render(
            <MarkdownRenderer>
                {':::note\nReview at 9:15.\n:::\n\n:::custom\nContent\n:::\n\n::pagebreak'}
            </MarkdownRenderer>,
        );

        expect(container.querySelector('.md-callout-info')?.textContent).toContain('Review at 9:15.');
        expect(container.querySelector('.md-custom')?.textContent).toContain('Content');
        expect(container.querySelector('hr.md-pagebreak')).not.toBeNull();
    });
});

describe.each([false, true])(
    'MarkdownRenderer math delimiters (preserveSourcePositions=%s)',
    (preserveSourcePositions) => {
        it.each([
            'Totals ($49,137,431.65) equal the sub-totals ($49,137,431.65).',
            'Totals ($10) vs ($20).',
            'Totals ($10) equals ($20).',
            'The fee is ($10), not ($20).',
            'Pfennig \u20B0 aside, totals ($10) vs ($20).',
            'Totals ($10) vs {estimate} ($20).',
        ])('renders currency as text: %s', (text) => {
            const { container } = render(
                <MarkdownRenderer preserveSourcePositions={preserveSourcePositions}>{text}</MarkdownRenderer>,
            );

            expect(container.querySelector('code, .katex')).toBeNull();
            expect(container.querySelector('p')?.textContent).toBe(text);
        });

        it.each([
            ['emphasis', 'Totals **$10** vs _plan_a_ (**$20**).', 'Totals $10 vs plan_a ($20).'],
            ['a reference-style label', 'Totals ($10) vs [plan_a] ($20).', 'Totals ($10) vs [plan_a] ($20).'],
            ['a link URL', 'Totals ($10) vs [plan](https://x.test/a_b) ($20).', 'Totals ($10) vs plan ($20).'],
            ['escaped markdown', 'Totals ($10) vs \\[plan\\_a\\] ($20).', 'Totals ($10) vs [plan_a] ($20).'],
        ])('renders currency around %s as text', (_label, markdown, text) => {
            const { container } = render(
                <MarkdownRenderer preserveSourcePositions={preserveSourcePositions}>{markdown}</MarkdownRenderer>,
            );

            expect(container.querySelector('code, .katex')).toBeNull();
            expect(container.querySelector('p')?.textContent).toBe(text);
        });

        it('renders math, \\$ in math and currency in links', async () => {
            const { container } = render(
                <MarkdownRenderer preserveSourcePositions={preserveSourcePositions}>
                    {'Cost $500M and $600M where $P = \\$2$, see [$100M and $200M](https://example.com/$100M)'}
                </MarkdownRenderer>,
            );

            expect(await renderedTex(container, 1)).toEqual(['P = \\text{\\textdollar}2']);
            expect(container.querySelector('p')?.textContent).toContain('Cost $500M and $600M where');
            expect(container.querySelector('a')?.textContent).toBe('$100M and $200M');
            expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/$100M');
        });

        it('gives user remark plugins the original $, not the internal mask', () => {
            const seen: string[] = [];
            const recordCurrency = () => (tree: Parameters<typeof visit>[0]) => {
                visit(tree, (node) => {
                    const { value, url } = node as { value?: unknown; url?: unknown };
                    if (typeof value === 'string' && node.type !== 'inlineMath') seen.push(value);
                    if (typeof url === 'string') seen.push(url);
                });
            };
            render(
                <MarkdownRenderer preserveSourcePositions={preserveSourcePositions} remarkPlugins={[recordCurrency]}>
                    {'Totals ($10) vs [($20)](https://x.test/$30).'}
                </MarkdownRenderer>,
            );

            // a link's url is visited before its text
            expect(seen.join('')).toBe('Totals ($10) vs https://x.test/$30($20).');
        });
    },
);
