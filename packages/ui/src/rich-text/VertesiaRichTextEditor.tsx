import {
    type Editor,
    isMarkdownSourcePreserving,
    MarkdownComponentEditor,
    type MarkdownComponentEditorProps,
    MarkdownDocumentEditor,
    type MarkdownDocumentEditorProps,
    MarkdownRichTextEditor,
    type MarkdownRichTextEditorProps,
    type RichTextCodeBlockRendererProps,
    type RichTextImageRendererProps,
    type RichTextLinkRendererProps,
    type RichTextOpaqueBlockRendererProps,
    type RichTextRenderers,
} from '@vertesia/rich-text';
import { Button, cn, Modal, ModalBody, ModalFooter, ModalTitle, Textarea } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useCallback, useState } from 'react';
import { CodeBlockHandlerProvider, useCodeBlockContext } from '../widgets/markdown/CodeBlockContext.js';
import { useCodeBlockRendererRegistry } from '../widgets/markdown/CodeBlockRendering.js';
import { createDefaultCodeBlockHandlers, ExpandCodeBlockHandler } from '../widgets/markdown/codeBlockHandlers.js';
import { MarkdownFigure } from '../widgets/markdown/MarkdownFigure.js';
import { MarkdownImage } from '../widgets/markdown/MarkdownImage.js';
import { MarkdownLink } from '../widgets/markdown/MarkdownLink.js';
import { MarkdownRenderer } from '../widgets/markdown/MarkdownRenderer.js';
import { EditorToolbar } from './EditorToolbar.js';

const defaultCodeBlockHandlers = createDefaultCodeBlockHandlers();

function VertesiaCodeBlockPreview({ code, language }: RichTextCodeBlockRendererProps) {
    const registry = useCodeBlockRendererRegistry();
    const CustomRenderer = language ? registry?.getComponent(language) : undefined;
    const DefaultRenderer = language ? defaultCodeBlockHandlers[language] : undefined;
    const Renderer = language?.startsWith('expand:') ? ExpandCodeBlockHandler : (CustomRenderer ?? DefaultRenderer);

    if (!Renderer) return null;
    return <Renderer code={code} language={language} />;
}

function VertesiaImagePreview({ src, alt, title }: RichTextImageRendererProps) {
    const { artifactRunId } = useCodeBlockContext();
    if (title) {
        return <MarkdownFigure src={src} alt={alt} caption={title} artifactRunId={artifactRunId} />;
    }
    return <MarkdownImage src={src} alt={alt} artifactRunId={artifactRunId} />;
}

function VertesiaLinkPreview({ href, title, children }: RichTextLinkRendererProps) {
    const { artifactRunId } = useCodeBlockContext();
    return (
        <MarkdownLink href={href} artifactRunId={artifactRunId}>
            <span title={title}>{children}</span>
        </MarkdownLink>
    );
}

function VertesiaOpaqueBlockPreview({ raw }: RichTextOpaqueBlockRendererProps) {
    const { artifactRunId } = useCodeBlockContext();
    return <MarkdownRenderer artifactRunId={artifactRunId}>{raw}</MarkdownRenderer>;
}

export const vertesiaRichTextRenderers: RichTextRenderers = {
    codeBlock: VertesiaCodeBlockPreview,
    image: VertesiaImagePreview,
    link: VertesiaLinkPreview,
    opaqueBlock: VertesiaOpaqueBlockPreview,
};

interface VertesiaEditorProps {
    artifactRunId?: string;
}

export interface VertesiaMarkdownRichTextEditorProps
    extends Omit<MarkdownRichTextEditorProps, keyof RichTextRenderers>,
        VertesiaEditorProps {}

export function VertesiaMarkdownRichTextEditor({ artifactRunId, ...props }: VertesiaMarkdownRichTextEditorProps) {
    return (
        <CodeBlockHandlerProvider artifactRunId={artifactRunId} MarkdownRenderer={MarkdownRenderer}>
            <MarkdownRichTextEditor {...props} {...vertesiaRichTextRenderers} />
        </CodeBlockHandlerProvider>
    );
}

export interface VertesiaMarkdownComponentEditorProps
    extends Omit<MarkdownComponentEditorProps, keyof RichTextRenderers>,
        VertesiaEditorProps {}

export function VertesiaMarkdownComponentEditor({
    artifactRunId,
    className,
    contentClassName,
    editorClassName,
    onEditor,
    ...props
}: VertesiaMarkdownComponentEditorProps) {
    const [editor, setEditor] = useState<Editor | null>(null);
    const handleEditor = useCallback(
        (next: Editor | null) => {
            setEditor(next);
            onEditor?.(next);
        },
        [onEditor],
    );

    return (
        <CodeBlockHandlerProvider artifactRunId={artifactRunId} MarkdownRenderer={MarkdownRenderer}>
            <div className={cn('overflow-hidden rounded-md border border-mixer-muted/30 bg-background', className)}>
                <EditorToolbar editor={editor} editable={props.editable !== false} />
                <MarkdownComponentEditor
                    {...props}
                    {...vertesiaRichTextRenderers}
                    onEditor={handleEditor}
                    contentClassName={cn('max-h-80 overflow-auto', contentClassName)}
                    editorClassName={cn('vprose prose-sm min-h-24 max-w-none px-3 py-2 outline-none', editorClassName)}
                />
            </div>
        </CodeBlockHandlerProvider>
    );
}

export interface VertesiaMarkdownDocumentEditorProps
    extends Omit<MarkdownDocumentEditorProps, keyof RichTextRenderers>,
        VertesiaEditorProps {
    /** When set, the toolbar shows comment controls that queue and send a batch to the agent. */
    onSendComment?: (message: string) => void | Promise<void>;
}

export function VertesiaMarkdownDocumentEditor({
    artifactRunId,
    className,
    contentClassName,
    editorClassName,
    onEditor,
    onSendComment,
    ...props
}: VertesiaMarkdownDocumentEditorProps) {
    const { t } = useUITranslation();
    const [editor, setEditor] = useState<Editor | null>(null);
    const handleEditor = useCallback(
        (next: Editor | null) => {
            setEditor(next);
            onEditor?.(next);
        },
        [onEditor],
    );
    const [editingMode, setEditingMode] = useState<'choose' | 'rich-text' | 'source'>(() =>
        isMarkdownSourcePreserving(props.value) ? 'rich-text' : 'choose',
    );
    const resolvedEditingMode = editingMode === 'choose' ? 'source' : editingMode;

    return (
        <CodeBlockHandlerProvider artifactRunId={artifactRunId} MarkdownRenderer={MarkdownRenderer}>
            {resolvedEditingMode === 'rich-text' ? (
                <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
                    <EditorToolbar editor={editor} editable={props.editable !== false} onSendComment={onSendComment} />
                    <MarkdownDocumentEditor
                        {...props}
                        {...vertesiaRichTextRenderers}
                        onEditor={handleEditor}
                        ariaLabel={props.ariaLabel ?? t('richText.documentEditor')}
                        className="flex min-h-0 flex-1 flex-col"
                        contentClassName={cn('min-h-0 flex-1 overflow-auto', contentClassName)}
                        editorClassName={cn(
                            'vprose prose-sm mx-auto min-h-full w-full max-w-5xl px-6 py-5 outline-none',
                            editorClassName,
                        )}
                    />
                </div>
            ) : (
                <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
                    <Textarea
                        value={props.value}
                        onChange={(event) => props.onChange?.(event.target.value)}
                        onFocus={() => props.onFocusChange?.(true)}
                        onBlur={() => props.onFocusChange?.(false)}
                        disabled={props.editable === false}
                        aria-label={t('richText.markdownSourceEditor')}
                        className={cn(
                            'vertesia-markdown-document-editor-content min-h-0 flex-1 resize-none rounded-none',
                            'border-0 px-6 py-5 font-mono text-sm leading-6 outline-none focus-visible:ring-0',
                            contentClassName,
                            editorClassName,
                        )}
                    />
                </div>
            )}
            <Modal
                isOpen={editingMode === 'choose'}
                onClose={() => setEditingMode('source')}
                className="sm:max-w-lg"
                disableCloseOnClickOutside
            >
                <ModalTitle>{t('richText.sourceCompatibilityWarningTitle')}</ModalTitle>
                <ModalBody>
                    <p className="text-sm text-muted">{t('richText.sourceCompatibilityWarningDescription')}</p>
                </ModalBody>
                <ModalFooter align="right">
                    <Button variant="outline" onClick={() => setEditingMode('source')}>
                        {t('richText.editMarkdownSource')}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingMode('rich-text')}>
                        {t('richText.continueRichText')}
                    </Button>
                </ModalFooter>
            </Modal>
        </CodeBlockHandlerProvider>
    );
}
