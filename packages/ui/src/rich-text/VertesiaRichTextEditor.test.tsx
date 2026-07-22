/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MarkdownRichTextEditor, type MarkdownRichTextEditorProps, setEditorMarkdown } from '@vertesia/rich-text';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/index.js';
import {
    VertesiaMarkdownComponentEditor,
    VertesiaMarkdownDocumentEditor,
    VertesiaMarkdownRichTextEditor,
    vertesiaRichTextRenderers,
} from './VertesiaRichTextEditor.js';

describe('VertesiaMarkdownRichTextEditor', () => {
    it('renders Markdown and emits serialized Markdown after an editor update', async () => {
        const onChange = vi.fn();
        let editor: Parameters<NonNullable<MarkdownRichTextEditorProps['onEditor']>>[0] = null;

        render(
            <VertesiaMarkdownRichTextEditor
                value="# Original heading"
                onChange={onChange}
                onEditor={(nextEditor) => {
                    editor = nextEditor;
                }}
            />,
        );

        expect(await screen.findByRole('heading', { name: 'Original heading' })).not.toBeNull();
        await waitFor(() => expect(editor).not.toBeNull());

        act(() => {
            if (editor) setEditorMarkdown(editor, '## Updated heading', true);
        });

        expect(await screen.findByRole('heading', { name: 'Updated heading' })).not.toBeNull();
        expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('## Updated heading'));
    });

    it('provides adapters for each Vertesia-specific Markdown surface', () => {
        expect(vertesiaRichTextRenderers.codeBlock).toBeTypeOf('function');
        expect(vertesiaRichTextRenderers.image).toBeTypeOf('function');
        expect(vertesiaRichTextRenderers.link).toBeTypeOf('function');
        expect(vertesiaRichTextRenderers.opaqueBlock).toBeTypeOf('function');
    });

    it('keeps the editor instance when a consumer passes new renderer component identities', async () => {
        const onEditor = vi.fn();
        const view = render(<MarkdownRichTextEditor value="Paragraph" codeBlock={() => null} onEditor={onEditor} />);
        await screen.findByText('Paragraph');
        const initialEditor = onEditor.mock.calls.find(([value]) => value)?.[0];

        view.rerender(<MarkdownRichTextEditor value="Paragraph" codeBlock={() => null} onEditor={onEditor} />);

        expect(onEditor.mock.calls.filter(([value]) => value).at(-1)?.[0]).toBe(initialEditor);
        expect(new Set(onEditor.mock.calls.flatMap(([value]) => (value ? [value] : [])))).toHaveLength(1);
    });

    it('defers external values while focused so the caret is not reset', async () => {
        const view = render(<MarkdownRichTextEditor value="Original paragraph" />);
        const textbox = await screen.findByRole('textbox');
        fireEvent.focus(textbox);

        view.rerender(<MarkdownRichTextEditor value="External paragraph" />);
        expect(screen.getByText('Original paragraph')).not.toBeNull();
        expect(screen.queryByText('External paragraph')).toBeNull();

        fireEvent.blur(textbox);
        expect(await screen.findByText('External paragraph')).not.toBeNull();
    });

    it('offers a formatting toolbar for both the compact component editor and the full-document editor', async () => {
        const { rerender } = render(
            <I18nProvider lng="en">
                <VertesiaMarkdownComponentEditor value="Component text" />
            </I18nProvider>,
        );

        expect(await screen.findByText('Component text')).not.toBeNull();
        // The compact component editor now carries the same formatting toolbar as the document editor.
        expect(await screen.findByRole('toolbar')).not.toBeNull();

        rerender(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor value="# Full document" />
            </I18nProvider>,
        );

        expect(await screen.findByRole('heading', { name: 'Full document' })).not.toBeNull();
        expect(await screen.findByRole('toolbar')).not.toBeNull();
        expect(screen.getByRole('textbox', { name: 'Markdown document editor' })).not.toBeNull();
    });

    it('puts the document hand-off in the editor toolbar and highlights it when edits are pending', async () => {
        const onSendChangesToAgent = vi.fn();
        const view = render(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor
                    value="Document text"
                    onSendChangesToAgent={onSendChangesToAgent}
                    hasUnsentChanges={false}
                />
            </I18nProvider>,
        );

        const inactiveButton = await screen.findByRole('button', { name: 'Send changes to agent' });
        expect(screen.getByRole('toolbar').contains(inactiveButton)).toBe(true);
        expect(inactiveButton).toHaveProperty('disabled', true);
        expect(inactiveButton.className).not.toContain('bg-primary');

        view.rerender(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor
                    value="Document text"
                    onSendChangesToAgent={onSendChangesToAgent}
                    hasUnsentChanges
                />
            </I18nProvider>,
        );

        const activeButton = screen.getByRole('button', { name: 'Send changes to agent' });
        expect(activeButton).toHaveProperty('disabled', false);
        expect(activeButton.className).toContain('bg-primary');
        fireEvent.click(activeButton);
        expect(onSendChangesToAgent).toHaveBeenCalledTimes(1);
    });

    it('sends selected-text comments while full-document content editing is locked', async () => {
        const onSendComment = vi.fn();
        let editor: Parameters<NonNullable<MarkdownRichTextEditorProps['onEditor']>>[0] = null;
        render(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor
                    value="Locked paragraph."
                    editable={false}
                    onSendComment={onSendComment}
                    onEditor={(nextEditor) => {
                        editor = nextEditor;
                    }}
                />
            </I18nProvider>,
        );

        await waitFor(() => expect(editor).not.toBeNull());
        act(() => {
            editor?.commands.setTextSelection({ from: 1, to: 7 });
        });
        expect(screen.getByRole('button', { name: 'Bold' })).toHaveProperty('disabled', true);
        const commentButton = await screen.findByRole('button', { name: 'Comment on selection' });
        expect(screen.getByRole('toolbar').contains(commentButton)).toBe(false);
        expect(commentButton.parentElement?.className).toContain('pointer-events-auto');
        expect(commentButton.parentElement?.className).toContain('z-100');
        fireEvent.click(commentButton);
        expect(screen.getByRole('dialog', { name: 'Comment on selection' })).not.toBeNull();
        fireEvent.change(screen.getByPlaceholderText('Describe how the agent should improve this section...'), {
            target: { value: 'Make this claim measurable.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
        fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }));

        await waitFor(() => expect(onSendComment).toHaveBeenCalledTimes(1));
        expect(onSendComment).toHaveBeenCalledWith(expect.stringContaining('“Locked”'));
        expect(onSendComment).toHaveBeenCalledWith(expect.stringContaining('Make this claim measurable.'));
    });

    it('opens structurally preserving normalized Markdown directly in rich-text mode', async () => {
        const onChange = vi.fn();
        render(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor value={'Setext heading\n=============='} onChange={onChange} />
            </I18nProvider>,
        );

        expect(await screen.findByRole('heading', { name: 'Setext heading' })).not.toBeNull();
        expect(screen.getByRole('textbox', { name: 'Markdown document editor' })).not.toBeNull();
        expect(screen.queryByRole('heading', { name: 'Some Markdown formatting may change' })).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('lets the user preserve Markdown source when normalization is lossy', async () => {
        const onChange = vi.fn();
        render(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor value="#" onChange={onChange} />
            </I18nProvider>,
        );

        expect(await screen.findByRole('heading', { name: 'Some Markdown formatting may change' })).not.toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Markdown source' }));

        const sourceEditor = screen.getByRole('textbox', { name: 'Markdown source editor' });
        expect((sourceEditor as HTMLTextAreaElement).value).toBe('#');
        fireEvent.change(sourceEditor, { target: { value: '##' } });
        expect(onChange).toHaveBeenLastCalledWith('##');
    });

    it('lets the user accept a lossy conversion and continue in rich-text mode', async () => {
        render(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor value="#" />
            </I18nProvider>,
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Continue with rich text' }));

        expect(await screen.findByRole('textbox', { name: 'Markdown document editor' })).not.toBeNull();
    });

    // Table row/column actions live in the toolbar's Table context dropdown (only when the caret is
    // in a table); list indent/outdent is handled by Tab / Shift-Tab rather than a toolbar control.
});
