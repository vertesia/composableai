import { MarkdownRichTextEditor, type MarkdownRichTextEditorProps } from './MarkdownRichTextEditor.js';

interface MarkdownEditorShellProps extends Omit<MarkdownRichTextEditorProps, 'className'> {
    className?: string;
    contentClassName?: string;
}

export interface MarkdownComponentEditorProps extends MarkdownEditorShellProps {}

export interface MarkdownDocumentEditorProps extends MarkdownEditorShellProps {}

function mergeClasses(...values: Array<string | undefined>): string {
    return values.filter(Boolean).join(' ');
}

export function MarkdownComponentEditor({
    className,
    contentClassName,
    onChangeDebounceMs = 0,
    ...props
}: MarkdownComponentEditorProps) {
    return (
        <div className={mergeClasses('vertesia-markdown-component-editor', className)}>
            <MarkdownRichTextEditor
                {...props}
                onChangeDebounceMs={onChangeDebounceMs}
                className={mergeClasses('vertesia-markdown-component-editor-content', contentClassName)}
            />
        </div>
    );
}

export function MarkdownDocumentEditor({
    className,
    contentClassName,
    onChangeDebounceMs = 150,
    ...props
}: MarkdownDocumentEditorProps) {
    return (
        <div className={mergeClasses('vertesia-markdown-document-editor', className)}>
            <MarkdownRichTextEditor
                {...props}
                onChangeDebounceMs={onChangeDebounceMs}
                className={mergeClasses('vertesia-markdown-document-editor-content', contentClassName)}
            />
        </div>
    );
}
