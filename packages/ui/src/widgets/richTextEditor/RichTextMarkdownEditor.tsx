import type { AnyExtension, Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { cn } from '@vertesia/ui/core';
import { useEffect, useRef } from 'react';
import { richTextExtensions } from './extensions.js';

export interface RichTextMarkdownEditorProps {
    /** Document content as markdown — the canonical source of truth. */
    value: string;
    /** Called with the serialized canonical markdown whenever the user edits. */
    onChange?: (markdown: string) => void;
    /**
     * When false the editor is read-only — e.g. while an agent turn is running and the
     * document is being revised. Defaults to true.
     */
    editable?: boolean;
    /** Extra classes applied to the editable surface. */
    className?: string;
    'aria-label'?: string;
    /** Extra Tiptap extensions appended to the shared set (e.g. comment highlights). Memoize it. */
    extensions?: AnyExtension[];
    /** Called once the Tiptap editor is ready — for selection capture, commands, decorations, etc. */
    onReady?: (editor: Editor) => void;
}

/**
 * Tiptap (ProseMirror) editor over markdown. Markdown is the single source of truth:
 * `value` is parsed into the document on load/external-update and serialized back via
 * `onChange`. The schema uses the shared {@link richTextExtensions} set so the editor and
 * the serializer stay in lockstep (see markdownRoundtrip.test.ts for the contract).
 */
export function RichTextMarkdownEditor({
    value,
    onChange,
    editable = true,
    className,
    'aria-label': ariaLabel,
    extensions: extraExtensions,
    onReady,
}: RichTextMarkdownEditorProps) {
    // Tracks whether the editor holds local edits the parent hasn't acknowledged yet.
    const dirtyRef = useRef(false);
    const editor = useEditor({
        extensions: extraExtensions ? [...richTextExtensions, ...extraExtensions] : richTextExtensions,
        content: value,
        contentType: 'markdown',
        editable,
        onUpdate: ({ editor }) => {
            dirtyRef.current = true;
            onChange?.(editor.getMarkdown());
        },
        editorProps: {
            attributes: {
                class: cn('prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-40', className),
                'aria-label': ariaLabel ?? 'Document editor',
            },
        },
    });

    // Sync an external `value` into the editor — but never clobber unsaved local edits.
    //  - If `value` already matches the editor content, the parent is in sync (e.g. our own
    //    onChange echoed back): mark clean and no-op. Idempotence of the canonical form
    //    means our own output compares equal, so this also prevents update loops.
    //  - Otherwise `value` is a genuine external change (refetch, or the agent revised the
    //    doc). Apply it only when it's safe: the editor has no unsaved edits, or it is
    //    read-only (the turn-based handoff — the user could only review while the agent
    //    edited). While the user is actively editing, a divergent external value is ignored
    //    so their work is never overwritten; the parent owns when `value` may change.
    useEffect(() => {
        if (!editor) return;
        if (value === editor.getMarkdown()) {
            dirtyRef.current = false;
            return;
        }
        if (dirtyRef.current && editable) return;
        editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
        dirtyRef.current = false;
    }, [editor, value, editable]);

    useEffect(() => {
        editor?.setEditable(editable);
    }, [editor, editable]);

    useEffect(() => {
        if (editor) onReady?.(editor);
    }, [editor, onReady]);

    return <EditorContent editor={editor} />;
}
