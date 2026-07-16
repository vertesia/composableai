import type { Editor } from '@tiptap/core';
import { useCallback, useState } from 'react';
import { MarkdownEditorToolbar, type MarkdownEditorToolbarLabels } from './MarkdownEditorToolbar.js';
import { MarkdownRichTextEditor, type MarkdownRichTextEditorProps } from './MarkdownRichTextEditor.js';

interface MarkdownEditorShellProps extends Omit<MarkdownRichTextEditorProps, 'className'> {
    className?: string;
    contentClassName?: string;
    toolbarClassName?: string;
    toolbarLabels?: Partial<MarkdownEditorToolbarLabels>;
    showToolbar?: boolean;
}

export interface MarkdownComponentEditorProps extends MarkdownEditorShellProps {}

export interface MarkdownDocumentEditorProps extends MarkdownEditorShellProps {}

function mergeClasses(...values: Array<string | undefined>): string {
    return values.filter(Boolean).join(' ');
}

export function MarkdownComponentEditor({
    className,
    contentClassName,
    toolbarClassName,
    toolbarLabels,
    showToolbar = true,
    onEditor,
    onChangeDebounceMs = 0,
    ...props
}: MarkdownComponentEditorProps) {
    const [editor, setEditor] = useState<Editor | null>(null);
    const handleEditor = useCallback(
        (nextEditor: Editor | null) => {
            setEditor(nextEditor);
            onEditor?.(nextEditor);
        },
        [onEditor],
    );

    return (
        <div className={mergeClasses('vertesia-markdown-component-editor', className)}>
            {showToolbar ? (
                <MarkdownEditorToolbar
                    editor={editor}
                    mode="component"
                    labels={toolbarLabels}
                    className={toolbarClassName}
                />
            ) : null}
            <MarkdownRichTextEditor
                {...props}
                onEditor={handleEditor}
                onChangeDebounceMs={onChangeDebounceMs}
                className={mergeClasses('vertesia-markdown-component-editor-content', contentClassName)}
            />
        </div>
    );
}

export function MarkdownDocumentEditor({
    className,
    contentClassName,
    toolbarClassName,
    toolbarLabels,
    showToolbar = true,
    onEditor,
    onChangeDebounceMs = 150,
    ...props
}: MarkdownDocumentEditorProps) {
    const [editor, setEditor] = useState<Editor | null>(null);
    const handleEditor = useCallback(
        (nextEditor: Editor | null) => {
            setEditor(nextEditor);
            onEditor?.(nextEditor);
        },
        [onEditor],
    );

    return (
        <div className={mergeClasses('vertesia-markdown-document-editor', className)}>
            {showToolbar ? (
                <MarkdownEditorToolbar
                    editor={editor}
                    mode="document"
                    labels={toolbarLabels}
                    className={toolbarClassName}
                />
            ) : null}
            <MarkdownRichTextEditor
                {...props}
                onEditor={handleEditor}
                onChangeDebounceMs={onChangeDebounceMs}
                className={mergeClasses('vertesia-markdown-document-editor-content', contentClassName)}
            />
        </div>
    );
}
