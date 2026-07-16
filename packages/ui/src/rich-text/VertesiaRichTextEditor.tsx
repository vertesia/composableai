import {
    MarkdownComponentEditor,
    type MarkdownComponentEditorProps,
    MarkdownDocumentEditor,
    type MarkdownDocumentEditorProps,
    type MarkdownEditorToolbarLabels,
    MarkdownRichTextEditor,
    type MarkdownRichTextEditorProps,
    type RichTextCodeBlockRendererProps,
    type RichTextImageRendererProps,
    type RichTextLinkRendererProps,
    type RichTextOpaqueBlockRendererProps,
    type RichTextRenderers,
} from '@vertesia/rich-text';
import { cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { CodeBlockHandlerProvider, useCodeBlockContext } from '../widgets/markdown/CodeBlockContext.js';
import { useCodeBlockRendererRegistry } from '../widgets/markdown/CodeBlockRendering.js';
import { createDefaultCodeBlockHandlers, ExpandCodeBlockHandler } from '../widgets/markdown/codeBlockHandlers.js';
import { MarkdownFigure } from '../widgets/markdown/MarkdownFigure.js';
import { MarkdownImage } from '../widgets/markdown/MarkdownImage.js';
import { MarkdownLink } from '../widgets/markdown/MarkdownLink.js';
import { MarkdownRenderer } from '../widgets/markdown/MarkdownRenderer.js';

const defaultCodeBlockHandlers = createDefaultCodeBlockHandlers();
const TOOLBAR_CLASS_NAME =
    'flex min-h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-mixer-muted/25 bg-muted/10 px-2 py-1 ' +
    '[&_.vertesia-rich-text-toolbar-button]:h-7 [&_.vertesia-rich-text-toolbar-button]:min-w-7 ' +
    '[&_.vertesia-rich-text-toolbar-button]:rounded [&_.vertesia-rich-text-toolbar-button]:px-1.5 ' +
    '[&_.vertesia-rich-text-toolbar-button]:text-xs [&_.vertesia-rich-text-toolbar-button]:text-muted ' +
    '[&_.vertesia-rich-text-toolbar-button:hover]:bg-muted/30 ' +
    '[&_.vertesia-rich-text-toolbar-button[data-active]]:bg-info/15 ' +
    '[&_.vertesia-rich-text-toolbar-button[data-active]]:text-info ' +
    '[&_.vertesia-rich-text-toolbar-button:disabled]:opacity-40 ' +
    '[&_.vertesia-rich-text-toolbar-select]:h-7 [&_.vertesia-rich-text-toolbar-select]:rounded ' +
    '[&_.vertesia-rich-text-toolbar-select]:border [&_.vertesia-rich-text-toolbar-select]:border-mixer-muted/30 ' +
    '[&_.vertesia-rich-text-toolbar-select]:bg-background [&_.vertesia-rich-text-toolbar-select]:px-2 ' +
    '[&_.vertesia-rich-text-toolbar-select]:text-xs [&_.vertesia-rich-text-toolbar-spacer]:flex-1';

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

function useToolbarLabels(overrides?: Partial<MarkdownEditorToolbarLabels>): Partial<MarkdownEditorToolbarLabels> {
    const { t } = useUITranslation();
    return {
        blockStyle: t('richText.blockStyle'),
        paragraph: t('richText.paragraph'),
        heading1: t('richText.heading1'),
        heading2: t('richText.heading2'),
        heading3: t('richText.heading3'),
        bold: t('richText.bold'),
        italic: t('richText.italic'),
        strike: t('richText.strike'),
        inlineCode: t('richText.inlineCode'),
        bulletList: t('richText.bulletList'),
        orderedList: t('richText.orderedList'),
        listActions: t('richText.listActions'),
        indentListItem: t('richText.indentListItem'),
        outdentListItem: t('richText.outdentListItem'),
        blockquote: t('richText.blockquote'),
        codeBlock: t('richText.codeBlock'),
        horizontalRule: t('richText.horizontalRule'),
        table: t('richText.table'),
        tableActions: t('richText.tableActions'),
        tableRows: t('richText.tableRows'),
        tableColumns: t('richText.tableColumns'),
        addRowAbove: t('richText.addRowAbove'),
        addRowBelow: t('richText.addRowBelow'),
        deleteRow: t('richText.deleteRow'),
        addColumnLeft: t('richText.addColumnLeft'),
        addColumnRight: t('richText.addColumnRight'),
        deleteColumn: t('richText.deleteColumn'),
        deleteTable: t('richText.deleteTable'),
        undo: t('richText.undo'),
        redo: t('richText.redo'),
        ...overrides,
    };
}

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
    toolbarClassName,
    toolbarLabels,
    ...props
}: VertesiaMarkdownComponentEditorProps) {
    const labels = useToolbarLabels(toolbarLabels);
    return (
        <CodeBlockHandlerProvider artifactRunId={artifactRunId} MarkdownRenderer={MarkdownRenderer}>
            <MarkdownComponentEditor
                {...props}
                {...vertesiaRichTextRenderers}
                className={cn('overflow-hidden rounded-md border border-mixer-muted/30 bg-background', className)}
                contentClassName={cn('max-h-80 overflow-auto', contentClassName)}
                editorClassName={cn('vprose prose-sm min-h-24 max-w-none px-3 py-2 outline-none', editorClassName)}
                toolbarClassName={cn(TOOLBAR_CLASS_NAME, toolbarClassName)}
                toolbarLabels={labels}
            />
        </CodeBlockHandlerProvider>
    );
}

export interface VertesiaMarkdownDocumentEditorProps
    extends Omit<MarkdownDocumentEditorProps, keyof RichTextRenderers>,
        VertesiaEditorProps {}

export function VertesiaMarkdownDocumentEditor({
    artifactRunId,
    className,
    contentClassName,
    editorClassName,
    toolbarClassName,
    toolbarLabels,
    ...props
}: VertesiaMarkdownDocumentEditorProps) {
    const { t } = useUITranslation();
    const labels = useToolbarLabels(toolbarLabels);
    return (
        <CodeBlockHandlerProvider artifactRunId={artifactRunId} MarkdownRenderer={MarkdownRenderer}>
            <MarkdownDocumentEditor
                {...props}
                {...vertesiaRichTextRenderers}
                ariaLabel={props.ariaLabel ?? t('richText.documentEditor')}
                className={cn('flex h-full min-h-0 flex-col bg-background', className)}
                contentClassName={cn('min-h-0 flex-1 overflow-auto', contentClassName)}
                editorClassName={cn(
                    'vprose prose-sm mx-auto min-h-full w-full max-w-5xl px-6 py-5 outline-none',
                    editorClassName,
                )}
                toolbarClassName={cn(TOOLBAR_CLASS_NAME, toolbarClassName)}
                toolbarLabels={labels}
            />
        </CodeBlockHandlerProvider>
    );
}
