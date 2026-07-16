import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { createVertesiaMarkdownExtensions, type VertesiaMarkdownKitOptions } from './markdown.js';
import type { RichTextRenderers } from './types.js';

export type ExternalValueSyncPolicy = 'always' | 'when-blurred' | 'manual';

export interface MarkdownRichTextEditorProps extends VertesiaMarkdownKitOptions {
    value: string;
    onChange?: (markdown: string) => void;
    onEditor?: (editor: Editor | null) => void;
    editable?: boolean;
    className?: string;
    editorClassName?: string;
    ariaLabel?: string;
    autoFocus?: boolean;
    onFocusChange?: (focused: boolean) => void;
    /**
     * Controls how a new value prop is applied after the editor mounts.
     *
     * - `when-blurred` avoids resetting selection and scroll while the user types.
     * - `always` applies the external value immediately.
     * - `manual` leaves reconciliation to the host.
     *
     * Transaction-level merging remains the host's responsibility for true concurrent editing.
     */
    externalValueSync?: ExternalValueSyncPolicy;
    /** Delay full-document Markdown serialization after an edit. Zero emits synchronously. */
    onChangeDebounceMs?: number;
}

function createStableRendererProxies(renderersRef: RefObject<RichTextRenderers>): RichTextRenderers {
    return {
        codeBlock(props) {
            const Renderer = renderersRef.current?.codeBlock;
            return Renderer ? <Renderer {...props} /> : null;
        },
        image(props) {
            const Renderer = renderersRef.current?.image;
            return Renderer ? <Renderer {...props} /> : null;
        },
        link(props) {
            const Renderer = renderersRef.current?.link;
            return Renderer ? <Renderer {...props} /> : props.children;
        },
        opaqueBlock(props) {
            const Renderer = renderersRef.current?.opaqueBlock;
            return Renderer ? <Renderer {...props} /> : null;
        },
    };
}

export function setEditorMarkdown(editor: Editor, markdown: string, emitUpdate = false): void {
    editor.commands.setContent(markdown, { contentType: 'markdown', emitUpdate });
}

export function MarkdownRichTextEditor({
    value,
    onChange,
    onEditor,
    editable = true,
    className,
    editorClassName,
    ariaLabel,
    autoFocus = false,
    onFocusChange,
    externalValueSync = 'when-blurred',
    onChangeDebounceMs = 0,
    codeBlock,
    image,
    link,
    opaqueBlock,
    tables = true,
    opaqueBlocks = true,
}: MarkdownRichTextEditorProps) {
    const renderersRef = useRef<RichTextRenderers>({ codeBlock, image, link, opaqueBlock });
    renderersRef.current = { codeBlock, image, link, opaqueBlock };
    const stableRenderers = useMemo(() => createStableRendererProxies(renderersRef), []);
    const onChangeRef = useRef(onChange);
    const onFocusChangeRef = useRef(onFocusChange);
    const debounceRef = useRef(onChangeDebounceMs);
    const externalValueSyncRef = useRef(externalValueSync);
    const lastSerializedMarkdownRef = useRef(value);
    const pendingExternalValueRef = useRef<string | undefined>(undefined);
    const changeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    onChangeRef.current = onChange;
    onFocusChangeRef.current = onFocusChange;
    debounceRef.current = onChangeDebounceMs;
    externalValueSyncRef.current = externalValueSync;

    const extensions = useMemo(
        () =>
            createVertesiaMarkdownExtensions({
                ...stableRenderers,
                tables,
                opaqueBlocks,
            }),
        [opaqueBlocks, stableRenderers, tables],
    );

    const editor = useEditor(
        {
            extensions,
            content: value,
            contentType: 'markdown',
            editable,
            autofocus: autoFocus,
            immediatelyRender: false,
            editorProps: {
                attributes: {
                    class: editorClassName || '',
                    role: 'textbox',
                    'aria-multiline': 'true',
                    ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
                },
            },
            onUpdate: ({ editor: updatedEditor }) => {
                if (changeTimeoutRef.current !== undefined) clearTimeout(changeTimeoutRef.current);

                const emitMarkdown = () => {
                    changeTimeoutRef.current = undefined;
                    const markdown = updatedEditor.getMarkdown();
                    lastSerializedMarkdownRef.current = markdown;
                    onChangeRef.current?.(markdown);
                };
                const delay = Math.max(0, debounceRef.current);
                if (delay === 0) {
                    emitMarkdown();
                } else {
                    changeTimeoutRef.current = setTimeout(emitMarkdown, delay);
                }
            },
            onFocus: () => onFocusChangeRef.current?.(true),
            onBlur: ({ editor: blurredEditor }) => {
                const pendingValue = pendingExternalValueRef.current;
                if (pendingValue !== undefined && externalValueSyncRef.current === 'when-blurred') {
                    pendingExternalValueRef.current = undefined;
                    if (changeTimeoutRef.current !== undefined) {
                        clearTimeout(changeTimeoutRef.current);
                        changeTimeoutRef.current = undefined;
                    }
                    setEditorMarkdown(blurredEditor, pendingValue);
                    lastSerializedMarkdownRef.current = pendingValue;
                }
                onFocusChangeRef.current?.(false);
            },
        },
        [extensions],
    );

    useEffect(() => {
        editor?.setEditable(editable);
    }, [editable, editor]);

    useEffect(() => {
        if (!editor || value === lastSerializedMarkdownRef.current) {
            pendingExternalValueRef.current = undefined;
            return;
        }
        if (externalValueSync === 'manual') return;
        if (externalValueSync === 'when-blurred' && editor.isFocused) {
            pendingExternalValueRef.current = value;
            return;
        }

        pendingExternalValueRef.current = undefined;
        if (changeTimeoutRef.current !== undefined) {
            clearTimeout(changeTimeoutRef.current);
            changeTimeoutRef.current = undefined;
        }
        setEditorMarkdown(editor, value);
        lastSerializedMarkdownRef.current = value;
    }, [editor, externalValueSync, value]);

    useEffect(() => {
        onEditor?.(editor);
        return () => onEditor?.(null);
    }, [editor, onEditor]);

    useEffect(
        () => () => {
            if (changeTimeoutRef.current !== undefined) clearTimeout(changeTimeoutRef.current);
        },
        [],
    );

    return <EditorContent editor={editor} className={className} />;
}
