/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { AGENT_LINE_CLAMP_CLASS, CollapsibleAgentMarkdown } from './CollapsibleAgentMarkdown.js';

afterEach(cleanup);

const renderMarkdown = (markdown: string, testId = 'prose') =>
    render(
        <I18nProvider lng="en">
            <CollapsibleAgentMarkdown data-testid={testId}>{markdown}</CollapsibleAgentMarkdown>
        </I18nProvider>,
    );

describe('CollapsibleAgentMarkdown', () => {
    it('renders markdown without a toggle when the content is short', () => {
        renderMarkdown('A **short** note.');
        expect(screen.getByText('short')).not.toBeNull();
        expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull();
    });

    it('renders a markdown table', () => {
        renderMarkdown('| A | B |\n| - | - |\n| 1 | 2 |');
        expect(screen.getByRole('table')).not.toBeNull();
    });

    it('collapses long content behind a show more / show less toggle', () => {
        const long = Array.from({ length: 10 }, (_, i) => `Line number ${i + 1} of the reference block.`).join('\n\n');
        renderMarkdown(long);

        const prose = screen.getByTestId('prose');
        const showMore = screen.getByRole('button', { name: /Show more/ });
        expect(showMore.getAttribute('aria-expanded')).toBe('false');
        expect(prose.getAttribute('class') ?? '').toContain(AGENT_LINE_CLAMP_CLASS.split(' ')[0]);

        fireEvent.click(showMore);

        const showLess = screen.getByRole('button', { name: /Show less/ });
        expect(showLess.getAttribute('aria-expanded')).toBe('true');
        expect(prose.getAttribute('class') ?? '').not.toContain('[-webkit-line-clamp:6]');
    });
});
