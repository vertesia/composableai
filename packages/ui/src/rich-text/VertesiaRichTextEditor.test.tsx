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

    it('offers a bare compact component surface and a full-document editor with a formatting toolbar', async () => {
        const { rerender } = render(
            <I18nProvider lng="en">
                <VertesiaMarkdownComponentEditor value="Component text" />
            </I18nProvider>,
        );

        expect(await screen.findByText('Component text')).not.toBeNull();
        // The compact component editor is chrome-free; the formatting toolbar is document-only.
        expect(screen.queryByRole('toolbar')).toBeNull();

        rerender(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor value="# Full document" />
            </I18nProvider>,
        );

        expect(await screen.findByRole('heading', { name: 'Full document' })).not.toBeNull();
        expect(await screen.findByRole('toolbar')).not.toBeNull();
        expect(screen.getByRole('textbox', { name: 'Markdown document editor' })).not.toBeNull();
    });

    it('warns before rich-text editing would normalize Markdown and lets the user preserve source', async () => {
        const onChange = vi.fn();
        render(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor value={'Setext heading\n=============='} onChange={onChange} />
            </I18nProvider>,
        );

        expect(await screen.findByRole('heading', { name: 'Some Markdown formatting may change' })).not.toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Edit Markdown source' }));

        const sourceEditor = screen.getByRole('textbox', { name: 'Markdown source editor' });
        expect((sourceEditor as HTMLTextAreaElement).value).toBe('Setext heading\n==============');
        fireEvent.change(sourceEditor, { target: { value: 'Updated heading\n===============' } });

        expect(onChange).toHaveBeenLastCalledWith('Updated heading\n===============');
        expect(screen.queryByRole('toolbar', { name: 'Markdown formatting' })).toBeNull();
    });

    it('lets the user accept Markdown normalization and continue in rich-text mode', async () => {
        render(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor value={'Setext heading\n=============='} />
            </I18nProvider>,
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Continue with rich text' }));

        expect(await screen.findByRole('heading', { name: 'Setext heading' })).not.toBeNull();
        expect(screen.getByRole('textbox', { name: 'Markdown document editor' })).not.toBeNull();
    });

    // Table row/column editing and list indent/outdent are intentionally not in the clean toolbar
    // (list nesting works via Tab / Shift-Tab; table structure editing is a planned context menu).
});
