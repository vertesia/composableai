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

    it('offers compact component and full-document editor surfaces', async () => {
        const { rerender } = render(
            <I18nProvider lng="en">
                <VertesiaMarkdownComponentEditor value="Component text" />
            </I18nProvider>,
        );

        expect(await screen.findByText('Component text')).not.toBeNull();
        expect(screen.getByRole('toolbar', { name: 'Markdown formatting' })).not.toBeNull();
        expect(screen.queryByRole('combobox', { name: 'Block style' })).toBeNull();

        rerender(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor value="# Full document" />
            </I18nProvider>,
        );

        expect(await screen.findByRole('heading', { name: 'Full document' })).not.toBeNull();
        expect(screen.getByRole('combobox', { name: 'Block style' })).not.toBeNull();
        expect(screen.getByRole('textbox', { name: 'Markdown document editor' })).not.toBeNull();
    });
});
