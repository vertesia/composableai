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
