import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../__tests__/test-utils.js';
import { AskUserWidget } from './AskUserWidget';

vi.mock('../../../widgets/markdown/MarkdownRenderer', () => ({
    MarkdownRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function getScrollablePrompt(container: HTMLElement): HTMLElement {
    const question = container.querySelector('.agent-ask-question');
    const scrollable = question?.parentElement;
    if (!scrollable) {
        throw new Error('Expected ask user question to be wrapped in a scrollable prompt container');
    }
    return scrollable;
}

describe('AskUserWidget', () => {
    it('keeps compact prompt text in a bounded scrollable area', () => {
        const { container } = renderWithProviders(
            <AskUserWidget
                compact
                hideBorder
                question={'Long prompt\n\n'.repeat(80)}
                allowFreeResponse
                submitLabel="Send"
            />,
        );

        const scrollable = getScrollablePrompt(container);

        expect(scrollable.className).toContain('max-h-80');
        expect(scrollable.className).toContain('overflow-y-auto');
        expect(scrollable.className).toContain('overscroll-contain');
    });

    it('keeps default prompt text in a bounded scrollable area', () => {
        const { container } = renderWithProviders(
            <AskUserWidget question={'Long prompt\n\n'.repeat(80)} allowFreeResponse submitLabel="Send" />,
        );

        const scrollable = getScrollablePrompt(container);

        expect(scrollable.className).toContain('max-h-80');
        expect(scrollable.className).toContain('overflow-y-auto');
        expect(scrollable.className).toContain('overscroll-contain');
    });
});
