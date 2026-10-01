// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer.js';

afterEach(cleanup);

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
        ])('renders currency as text: %s', (text) => {
            const { container } = render(
                <MarkdownRenderer preserveSourcePositions={preserveSourcePositions}>{text}</MarkdownRenderer>,
            );

            expect(container.querySelector('code')).toBeNull();
            expect(container.querySelector('p')?.textContent).toBe(text);
        });

        it('renders math, \\$ in math and currency in links', () => {
            const { container } = render(
                <MarkdownRenderer preserveSourcePositions={preserveSourcePositions}>
                    {'Cost $500M and $600M where $P = \\$2$, see [$100M and $200M](https://example.com/$100M)'}
                </MarkdownRenderer>,
            );

            const math = container.querySelectorAll('code');
            expect(math).toHaveLength(1);
            expect(math[0].textContent).toBe('P = \\text{\\textdollar}2');
            expect(container.querySelector('p')?.textContent).toContain('Cost $500M and $600M where');
            expect(container.querySelector('a')?.textContent).toBe('$100M and $200M');
            expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/$100M');
        });
    },
);
