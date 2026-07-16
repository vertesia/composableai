/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/index.js';
import {
    ArtifactEditingSurface,
    applyArtifactRefreshChanges,
    getMarkdownChangeRegions,
    isArtifactRefreshEvent,
} from './ArtifactEditingSurface.js';
import type { MarkdownEditingAction } from './CollaborativeMarkdownRenderer.js';

const mocks = vi.hoisted(() => {
    const getArtifactContent = vi.fn();
    const updateArtifactContent = vi.fn();
    return {
        client: { agents: { getArtifactContent, updateArtifactContent } },
        getArtifactContent,
        updateArtifactContent,
    };
});

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: mocks.client,
    }),
}));

function renderSurface(props?: {
    refreshKey?: number;
    viewMode?: 'components' | 'document';
    baselineContent?: string;
    onAction?: (action: MarkdownEditingAction) => void;
    flushChangesRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}) {
    return render(
        <I18nProvider lng="en">
            <ArtifactEditingSurface
                runId="run-1"
                path="drafts/document.md"
                refreshKey={props?.refreshKey}
                viewMode={props?.viewMode}
                baselineContent={props?.baselineContent}
                onAction={props?.onAction}
                flushChangesRef={props?.flushChangesRef}
            />
        </I18nProvider>,
    );
}

describe('ArtifactEditingSurface', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getArtifactContent.mockResolvedValue({
            path: 'drafts/document.md',
            content: 'Original paragraph.',
            generation: 'generation-1',
        });
        mocks.updateArtifactContent.mockResolvedValue({
            path: 'drafts/document.md',
            generation: 'generation-2',
        });
    });

    it('conditionally saves a direct block edit to the artifact and marks the action applied', async () => {
        const onAction = vi.fn();
        renderSurface({ onAction });

        await screen.findByText('Original paragraph.');
        fireEvent.click(screen.getByRole('button', { name: 'Edit selection' }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Revised paragraph.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => {
            expect(mocks.updateArtifactContent).toHaveBeenCalledWith('run-1', 'drafts/document.md', {
                content: 'Revised paragraph.',
                generation: 'generation-1',
            });
        });
        expect(await screen.findByText('Revised paragraph.')).not.toBeNull();
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'edit',
                applied: true,
                base_version: 'generation-2',
                user_change: { before: 'Original paragraph.', after: 'Revised paragraph.' },
            }),
        );
    });

    it('keeps rendered content mounted while loading a newer artifact generation', async () => {
        const pendingRefresh = new Promise<never>(() => undefined);
        const view = renderSurface();
        await screen.findByText('Original paragraph.');

        mocks.getArtifactContent.mockReturnValueOnce(pendingRefresh);
        view.rerender(
            <I18nProvider lng="en">
                <ArtifactEditingSurface runId="run-1" path="drafts/document.md" refreshKey={1} />
            </I18nProvider>,
        );

        expect(screen.getByText('Original paragraph.')).not.toBeNull();
    });

    it('applies streamed replacements before the background artifact reconciliation finishes', async () => {
        const pendingRefresh = new Promise<never>(() => undefined);
        const view = renderSurface();
        await screen.findByText('Original paragraph.');

        mocks.getArtifactContent.mockReturnValueOnce(pendingRefresh);
        view.rerender(
            <I18nProvider lng="en">
                <ArtifactEditingSurface
                    runId="run-1"
                    path="drafts/document.md"
                    refreshKey={1}
                    refreshDetails={{
                        changes: [
                            {
                                operation: 'replace',
                                before: 'Original paragraph.',
                                after: 'Revised paragraph.',
                                replace_all: false,
                            },
                        ],
                    }}
                />
            </I18nProvider>,
        );

        expect(await screen.findByText('Revised paragraph.')).not.toBeNull();
    });

    it('edits and conditionally persists the working copy in full-document mode', async () => {
        const user = userEvent.setup();
        renderSurface({ viewMode: 'document' });

        const editor = await screen.findByRole('textbox', { name: 'Markdown document editor' });
        await user.click(editor);
        await user.type(editor, ' revised');

        await waitFor(
            () => {
                expect(mocks.updateArtifactContent).toHaveBeenCalledWith('run-1', 'drafts/document.md', {
                    content: expect.stringContaining('revised'),
                    generation: 'generation-1',
                });
            },
            { timeout: 2500 },
        );
    });

    it('flushes the latest editor transaction before handing changes to the agent', async () => {
        const user = userEvent.setup();
        const flushChangesRef: React.MutableRefObject<(() => Promise<boolean>) | null> = { current: null };
        renderSurface({ viewMode: 'document', flushChangesRef });

        const editor = await screen.findByRole('textbox', { name: 'Markdown document editor' });
        await user.click(editor);
        await user.type(editor, ' immediate');

        expect(flushChangesRef.current).not.toBeNull();
        expect(await flushChangesRef.current?.()).toBe(true);
        expect(mocks.updateArtifactContent).toHaveBeenCalledWith('run-1', 'drafts/document.md', {
            content: expect.stringContaining('immediate'),
            generation: 'generation-1',
        });
    });

    it('shows a navigable ruler for changes from the original document', async () => {
        renderSurface({ viewMode: 'document', baselineContent: 'Different paragraph.' });

        await screen.findByRole('textbox', { name: 'Markdown document editor' });
        expect(screen.getByRole('navigation', { name: 'Change ruler' })).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Change near line 1' })).not.toBeNull();
    });

    it('keeps the focused editor base generation when the agent refreshes the artifact', async () => {
        const user = userEvent.setup();
        const view = renderSurface({ viewMode: 'document' });
        const editor = await screen.findByRole('textbox', { name: 'Markdown document editor' });
        await user.click(editor);

        mocks.getArtifactContent.mockResolvedValueOnce({
            path: 'drafts/document.md',
            content: 'Agent revision.',
            generation: 'generation-agent',
        });
        view.rerender(
            <I18nProvider lng="en">
                <ArtifactEditingSurface runId="run-1" path="drafts/document.md" refreshKey={1} viewMode="document" />
            </I18nProvider>,
        );
        await waitFor(() => expect(mocks.getArtifactContent).toHaveBeenCalledTimes(2));

        await user.type(editor, ' local edit');

        await waitFor(
            () => {
                expect(mocks.updateArtifactContent).toHaveBeenCalledWith('run-1', 'drafts/document.md', {
                    content: expect.stringContaining('local edit'),
                    generation: 'generation-1',
                });
            },
            { timeout: 2500 },
        );
    });
});

describe('getMarkdownChangeRegions', () => {
    it('maps additions and removals onto merged current-document line regions', () => {
        expect(getMarkdownChangeRegions('One\nTwo\nThree', 'One\nChanged\nThree\nFour')).toEqual([
            { startLine: 1, endLine: 3 },
        ]);
    });

    it('returns no regions for unchanged Markdown', () => {
        expect(getMarkdownChangeRegions('Same', 'Same')).toEqual([]);
    });
});

describe('isArtifactRefreshEvent', () => {
    it('accepts dedicated artifact updates and legacy path-bearing edit completions', () => {
        expect(
            isArtifactRefreshEvent(
                { event_class: 'artifact_updated', path: 'drafts/document.md' },
                'drafts/document.md',
            ),
        ).toBe(true);
        expect(
            isArtifactRefreshEvent(
                {
                    event_class: 'activity',
                    tool: 'edit_artifact',
                    tool_status: 'completed',
                    path: 'drafts/document.md',
                },
                'drafts/document.md',
            ),
        ).toBe(true);
    });

    it('rejects unrelated progress and other artifact paths', () => {
        expect(
            isArtifactRefreshEvent(
                {
                    event_class: 'activity',
                    tool: 'edit_artifact',
                    tool_status: 'running',
                    path: 'drafts/document.md',
                },
                'drafts/document.md',
            ),
        ).toBe(false);
        expect(
            isArtifactRefreshEvent({ event_class: 'artifact_updated', path: 'drafts/other.md' }, 'drafts/document.md'),
        ).toBe(false);
    });
});

describe('applyArtifactRefreshChanges', () => {
    it('applies sequential replacements from the stream details payload', () => {
        expect(
            applyArtifactRefreshChanges('Goals\n- One\n- Two', {
                changes: [
                    { operation: 'replace', before: '- One', after: '- First', replace_all: false },
                    { operation: 'replace', before: '- Two', after: '- Second', replace_all: false },
                ],
            }),
        ).toBe('Goals\n- First\n- Second');
    });

    it('falls back when the streamed change cannot be applied safely', () => {
        expect(
            applyArtifactRefreshChanges('Repeated Repeated', {
                changes: [{ operation: 'replace', before: 'Repeated', after: 'Changed', replace_all: false }],
            }),
        ).toBeUndefined();
    });
});
