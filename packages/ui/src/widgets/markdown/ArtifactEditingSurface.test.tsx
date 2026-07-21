/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/index.js';
import {
    ArtifactEditingSurface,
    type ArtifactEditingSurfaceDocumentEdit,
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
    flushChangesRef?: React.MutableRefObject<(() => Promise<false | ArtifactEditingSurfaceDocumentEdit>) | null>;
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
        vi.resetAllMocks();
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
        const flushChangesRef: React.MutableRefObject<
            (() => Promise<false | ArtifactEditingSurfaceDocumentEdit>) | null
        > = { current: null };
        renderSurface({ viewMode: 'document', flushChangesRef });

        const editor = await screen.findByRole('textbox', { name: 'Markdown document editor' });
        await user.click(editor);
        await user.type(editor, ' immediate');

        expect(flushChangesRef.current).not.toBeNull();
        // The flush reports the delta since the agent's last known content so the
        // caller can hand the agent an exact diff of the direct edits.
        expect(await flushChangesRef.current?.()).toEqual({
            previous: 'Original paragraph.',
            current: expect.stringContaining('immediate'),
        });
        expect(mocks.updateArtifactContent).toHaveBeenCalledWith('run-1', 'drafts/document.md', {
            content: expect.stringContaining('immediate'),
            generation: 'generation-1',
        });
    });

    it('flushes a pending debounced document save when the editor unmounts', async () => {
        mocks.getArtifactContent.mockResolvedValueOnce({
            path: 'drafts/document.md',
            content: 'Setext heading\n==============',
            generation: 'generation-1',
        });
        const view = renderSurface({ viewMode: 'document' });

        fireEvent.click(await screen.findByRole('button', { name: 'Edit Markdown source' }));
        const sourceEditor = screen.getByRole('textbox', { name: 'Markdown source editor' });
        fireEvent.focus(sourceEditor);
        fireEvent.change(sourceEditor, {
            target: { value: 'Updated heading\n===============' },
        });
        expect(mocks.updateArtifactContent).not.toHaveBeenCalled();

        view.unmount();

        await waitFor(() => {
            expect(mocks.updateArtifactContent).toHaveBeenCalledWith('run-1', 'drafts/document.md', {
                content: 'Updated heading\n===============',
                generation: 'generation-1',
            });
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

    it('rebases focused full-document edits over a non-overlapping agent change after 412', async () => {
        const user = userEvent.setup();
        const baseContent = 'First paragraph.\n\nSecond paragraph.';
        const remoteContent = 'First paragraph updated remotely.\n\nSecond paragraph.';
        mocks.getArtifactContent
            .mockResolvedValueOnce({
                path: 'drafts/document.md',
                content: baseContent,
                generation: 'generation-1',
            })
            .mockResolvedValueOnce({
                path: 'drafts/document.md',
                content: remoteContent,
                generation: 'generation-agent',
            })
            .mockResolvedValueOnce({
                path: 'drafts/document.md',
                content: remoteContent,
                generation: 'generation-agent',
            });
        mocks.updateArtifactContent
            .mockRejectedValueOnce({ status: 412 })
            .mockResolvedValueOnce({ path: 'drafts/document.md', generation: 'generation-merged' });

        const view = renderSurface({ viewMode: 'document' });
        const editor = await screen.findByRole('textbox', { name: 'Markdown document editor' });
        await user.click(editor);

        view.rerender(
            <I18nProvider lng="en">
                <ArtifactEditingSurface runId="run-1" path="drafts/document.md" refreshKey={1} viewMode="document" />
            </I18nProvider>,
        );
        await waitFor(() => expect(mocks.getArtifactContent).toHaveBeenCalledTimes(2));

        editor.focus();
        const secondParagraphText = editor.querySelectorAll('p')[1]?.firstChild;
        if (!secondParagraphText) {
            throw new Error('Expected the second paragraph to have a text node');
        }
        const range = document.createRange();
        range.setStart(secondParagraphText, secondParagraphText.textContent?.length ?? 0);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        await user.type(editor, ' local edit', { skipClick: true });

        await waitFor(
            () => {
                expect(mocks.updateArtifactContent).toHaveBeenNthCalledWith(2, 'run-1', 'drafts/document.md', {
                    content: expect.stringMatching(/updated remotely[\s\S]*Second paragraph\. local edit/),
                    generation: 'generation-agent',
                });
            },
            { timeout: 2500 },
        );
        expect(screen.queryByRole('alert')).toBeNull();
        expect(editor.textContent).toContain('First paragraph updated remotely.');
    });

    it('preserves overlapping full-document edits behind a conflict banner after 412', async () => {
        const user = userEvent.setup();
        mocks.getArtifactContent
            .mockResolvedValueOnce({
                path: 'drafts/document.md',
                content: 'Original paragraph.',
                generation: 'generation-1',
            })
            .mockResolvedValueOnce({
                path: 'drafts/document.md',
                content: 'Remote paragraph.',
                generation: 'generation-agent',
            });
        mocks.updateArtifactContent.mockRejectedValueOnce({ status: 412 });
        renderSurface({ viewMode: 'document' });

        const editor = await screen.findByRole('textbox', { name: 'Markdown document editor' });
        await user.click(editor);
        await user.type(editor, ' local edit');

        expect((await screen.findByRole('alert')).textContent).toContain('Working copy changed elsewhere');
        expect(screen.getByRole('button', { name: 'Try merge again' })).not.toBeNull();
        expect(editor.textContent).toContain('local edit');
        expect(screen.queryByText('Saved to working copy')).toBeNull();
        expect(mocks.updateArtifactContent).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'Try merge again' }));
        await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
        expect(mocks.updateArtifactContent).toHaveBeenNthCalledWith(2, 'run-1', 'drafts/document.md', {
            content: expect.stringContaining('local edit'),
            generation: 'generation-1',
        });
    });

    it('rebases a component edit and reports it as applied after 412', async () => {
        const user = userEvent.setup();
        const onAction = vi.fn();
        const baseContent = 'First paragraph.\n\nSecond paragraph.';
        const remoteContent = 'First paragraph updated remotely.\n\nSecond paragraph.';
        mocks.getArtifactContent
            .mockResolvedValueOnce({
                path: 'drafts/document.md',
                content: baseContent,
                generation: 'generation-1',
            })
            .mockResolvedValueOnce({
                path: 'drafts/document.md',
                content: remoteContent,
                generation: 'generation-agent',
            });
        mocks.updateArtifactContent
            .mockRejectedValueOnce({ status: 412 })
            .mockResolvedValueOnce({ path: 'drafts/document.md', generation: 'generation-merged' });
        renderSurface({ onAction });

        await screen.findByText('Second paragraph.');
        const editButtons = screen.getAllByRole('button', { name: 'Edit selection' });
        fireEvent.click(editButtons[editButtons.length - 1]);
        const editor = await screen.findByRole('textbox');
        await user.click(editor);
        await user.clear(editor);
        await user.type(editor, 'Second paragraph edited locally.');
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => {
            expect(mocks.updateArtifactContent).toHaveBeenNthCalledWith(2, 'run-1', 'drafts/document.md', {
                content: 'First paragraph updated remotely.\n\nSecond paragraph edited locally.',
                generation: 'generation-agent',
            });
        });
        expect(await screen.findByText('First paragraph updated remotely.')).not.toBeNull();
        expect(await screen.findByText('Second paragraph edited locally.')).not.toBeNull();
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({ applied: true, base_version: 'generation-merged' }),
        );
    });

    it('retains a conflicted component action and notifies the agent after retry succeeds', async () => {
        const user = userEvent.setup();
        const onAction = vi.fn();
        mocks.getArtifactContent
            .mockResolvedValueOnce({
                path: 'drafts/document.md',
                content: 'Original paragraph.',
                generation: 'generation-1',
            })
            .mockResolvedValueOnce({
                path: 'drafts/document.md',
                content: 'Remote paragraph.',
                generation: 'generation-agent',
            });
        mocks.updateArtifactContent.mockRejectedValueOnce({ status: 412 });
        renderSurface({ onAction });

        await screen.findByText('Original paragraph.');
        fireEvent.click(screen.getByRole('button', { name: 'Edit selection' }));
        const editor = await screen.findByRole('textbox');
        await user.click(editor);
        await user.clear(editor);
        await user.type(editor, 'Local paragraph.');
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await screen.findByRole('alert');
        expect(onAction).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Try merge again' }));

        await waitFor(() => {
            expect(onAction).toHaveBeenCalledWith(
                expect.objectContaining({ applied: true, base_version: 'generation-2' }),
            );
        });
        expect(await screen.findByText('Local paragraph.')).not.toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('getMarkdownChangeRegions', () => {
    it('maps additions and removals onto distinct current-document line regions', () => {
        expect(getMarkdownChangeRegions('One\nTwo\nThree', 'One\nChanged\nThree\nFour')).toEqual([
            { startLine: 1, endLine: 1 },
            { startLine: 3, endLine: 3 },
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
