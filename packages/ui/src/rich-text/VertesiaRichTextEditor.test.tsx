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

    it('offers contextual row and column actions while editing a table', async () => {
        let editor: Parameters<NonNullable<MarkdownRichTextEditorProps['onEditor']>>[0] = null;
        render(
            <I18nProvider lng="en">
                <VertesiaMarkdownDocumentEditor
                    value={'| Name | Value |\n| --- | --- |\n| Aurora | 1 |'}
                    onEditor={(nextEditor) => {
                        editor = nextEditor;
                    }}
                />
            </I18nProvider>,
        );

        await waitFor(() => expect(editor).not.toBeNull());
        expect(screen.queryByRole('combobox', { name: 'Table actions' })).toBeNull();

        act(() => {
            const currentEditor = editor;
            if (!currentEditor) throw new Error('Expected the editor to be ready');
            let cellTextPosition: number | undefined;
            currentEditor.state.doc.descendants((node, position) => {
                if (cellTextPosition === undefined && node.type.name === 'tableCell') {
                    cellTextPosition = position + 2;
                }
            });
            if (cellTextPosition === undefined) throw new Error('Expected a table body cell');
            currentEditor.commands.setTextSelection(cellTextPosition);
        });

        const countNodes = (type: string): number => {
            const currentEditor = editor;
            if (!currentEditor) return 0;
            let count = 0;
            currentEditor.state.doc.descendants((node) => {
                if (node.type.name === type) count += 1;
            });
            return count;
        };
        const runTableAction = (action: string) => {
            fireEvent.change(screen.getByRole('combobox', { name: 'Table actions' }), {
                target: { value: action },
            });
        };

        expect(await screen.findByRole('option', { name: 'Add row below' })).not.toBeNull();
        runTableAction('add-row-below');
        expect(countNodes('tableRow')).toBe(3);

        runTableAction('add-column-right');
        expect(countNodes('tableCell') + countNodes('tableHeader')).toBe(9);

        runTableAction('delete-column');
        expect(countNodes('tableCell') + countNodes('tableHeader')).toBe(6);

        runTableAction('delete-row');
        expect(countNodes('tableRow')).toBe(2);

        runTableAction('delete-table');
        expect(countNodes('table')).toBe(0);
        expect(screen.queryByRole('combobox', { name: 'Table actions' })).toBeNull();
    });

    it('offers contextual list nesting actions', async () => {
        let editor: Parameters<NonNullable<MarkdownRichTextEditorProps['onEditor']>>[0] = null;
        render(
            <I18nProvider lng="en">
                <VertesiaMarkdownComponentEditor
                    value={'- First item\n- Second item'}
                    onEditor={(nextEditor) => {
                        editor = nextEditor;
                    }}
                />
            </I18nProvider>,
        );

        await waitFor(() => expect(editor).not.toBeNull());
        act(() => {
            const currentEditor = editor;
            if (!currentEditor) throw new Error('Expected the editor to be ready');
            const listItemPositions: number[] = [];
            currentEditor.state.doc.descendants((node, position) => {
                if (node.type.name === 'listItem') listItemPositions.push(position + 2);
            });
            const secondItemPosition = listItemPositions[1];
            if (secondItemPosition === undefined) throw new Error('Expected a second list item');
            currentEditor.commands.setTextSelection(secondItemPosition);
        });

        const countLists = (): number => {
            const currentEditor = editor;
            if (!currentEditor) return 0;
            let count = 0;
            currentEditor.state.doc.descendants((node) => {
                if (node.type.name === 'bulletList') count += 1;
            });
            return count;
        };
        const runListAction = (action: string) => {
            fireEvent.change(screen.getByRole('combobox', { name: 'List actions' }), {
                target: { value: action },
            });
        };

        expect(await screen.findByRole('option', { name: 'Increase indent' })).not.toBeNull();
        runListAction('indent-list-item');
        expect(countLists()).toBe(2);

        runListAction('outdent-list-item');
        expect(countLists()).toBe(1);
    });
});
