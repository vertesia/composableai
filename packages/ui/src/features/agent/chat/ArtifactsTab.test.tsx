/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { ArtifactsTab } from './ArtifactsTab.js';

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({ client: {} }),
}));

vi.mock('@vertesia/ui/widgets', () => ({
    ArtifactEditingSurface: ({ viewMode }: { viewMode?: 'components' | 'document' }) => (
        <div data-testid="artifact-editing-surface" data-view-mode={viewMode} />
    ),
}));

vi.mock('./hooks/useArtifacts.js', () => ({
    useArtifacts: () => ({
        tree: [],
        flatFiles: [{ path: 'drafts/brief.md' }],
        isLoading: false,
        error: undefined,
        refresh: vi.fn(),
    }),
}));

afterEach(cleanup);

function renderArtifactEditor(props?: Partial<ComponentProps<typeof ArtifactsTab>>) {
    return render(
        <I18nProvider lng="en">
            <ArtifactsTab runId="run-1" selectedPath="drafts/brief.md" onSendMessage={vi.fn()} {...props} />
        </I18nProvider>,
    );
}

describe('ArtifactsTab', () => {
    it('opens editable artifacts in block mode by default', () => {
        renderArtifactEditor();

        expect(screen.getByTestId('artifact-editing-surface').getAttribute('data-view-mode')).toBe('components');
        expect(screen.getByRole('button', { name: 'Block mode' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('allows switching from block mode to the full editor', () => {
        renderArtifactEditor();

        fireEvent.click(screen.getByRole('button', { name: 'Edit mode' }));

        expect(screen.getByTestId('artifact-editing-surface').getAttribute('data-view-mode')).toBe('document');
        expect(screen.getByRole('button', { name: 'Edit mode' }).getAttribute('aria-pressed')).toBe('true');
    });
});
