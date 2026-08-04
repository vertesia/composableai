/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { ContentObject } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { TextEditorPanel } from './TextEditorPanel.js';

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    update: vi.fn(),
}));

vi.mock('@vertesia/ui/router', () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        store: { objects: { update: mocks.update } },
    }),
}));

describe('TextEditorPanel', () => {
    it.each(['text/markdown', 'text/x-markdown'])(
        'uses the full rich-text document editor for %s content',
        async (contentType) => {
            const object = {
                id: 'document-1',
                content: {
                    type: contentType,
                    name: 'document.md',
                    etag: 'etag-1',
                },
            } as unknown as ContentObject;

            render(
                <I18nProvider lng="en">
                    <TextEditorPanel object={object} text="# Editable document" onClose={vi.fn()} onSaved={vi.fn()} />
                </I18nProvider>,
            );

            expect(await screen.findByRole('textbox', { name: 'Markdown document editor' })).not.toBeNull();
            expect(screen.getByRole('heading', { name: 'Editable document' })).not.toBeNull();
            expect(await screen.findByRole('toolbar')).not.toBeNull();
        },
    );
});
