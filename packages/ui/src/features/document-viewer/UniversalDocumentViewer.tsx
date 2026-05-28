import { type ComponentType, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircleIcon, FileIcon, Loader2Icon } from 'lucide-react';
import { Button, cn } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { MarkdownRenderer, type MarkdownRendererProps, XMLViewer } from '@vertesia/ui/widgets';
import { SimplePdfViewer } from '../pdf-viewer/SimplePdfViewer.js';

export type UniversalDocumentRenditionTarget = 'pdf' | 'markdown' | 'text' | 'image';

export interface UniversalDocumentSource {
    id?: string;
    title?: string;
    fileName?: string;
    contentType?: string;
    url?: string;
    sourcePath?: string;
    content?: string;
    artifact?: {
        runId: string;
        path: string;
    };
}

export interface UniversalDocumentRendition {
    url?: string;
    sourcePath?: string;
    content?: string;
    contentType?: string;
    fileName?: string;
}

export interface UniversalDocumentViewerContext {
    source: UniversalDocumentSource;
    fileName: string;
    extension: string;
    contentType?: string;
    url?: string;
    content?: string;
    isLoading: boolean;
    error: string | null;
    reload: () => void;
}

export interface UniversalDocumentRenderer {
    id: string;
    canRender: (context: UniversalDocumentViewerContext) => boolean;
    render?: (context: UniversalDocumentViewerContext) => ReactNode;
    Component?: ComponentType<{ context: UniversalDocumentViewerContext }>;
}

export interface UniversalDocumentConverterContext {
    source: UniversalDocumentSource;
    fileName: string;
    extension: string;
    contentType?: string;
    target: UniversalDocumentRenditionTarget;
}

export interface UniversalDocumentConverter {
    id: string;
    target: UniversalDocumentRenditionTarget;
    canConvert: (context: UniversalDocumentConverterContext) => boolean;
    convert: (context: UniversalDocumentConverterContext) => Promise<UniversalDocumentRendition | null>;
}

export interface UniversalDocumentViewerProps {
    source: UniversalDocumentSource;
    className?: string;
    bodyClassName?: string;
    renderers?: UniversalDocumentRenderer[];
    converters?: UniversalDocumentConverter[];
    resolveUrl?: (source: UniversalDocumentSource, disposition: 'inline' | 'attachment') => Promise<string>;
    loadText?: (source: UniversalDocumentSource) => Promise<string>;
    /**
     * @deprecated Use converters instead.
     */
    createRendition?: (
        source: UniversalDocumentSource,
        target: UniversalDocumentRenditionTarget,
    ) => Promise<UniversalDocumentRendition | null>;
    markdownComponents?: MarkdownRendererProps['components'];
    showHeader?: boolean;
    onDownload?: (source: UniversalDocumentSource) => void;
}

function getFileName(source: UniversalDocumentSource): string {
    return (
        source.fileName ||
        source.title ||
        source.artifact?.path.split('/').pop() ||
        source.sourcePath?.split('/').pop() ||
        'Document'
    );
}

function getExtension(fileName: string): string {
    const cleanName = fileName.split('?')[0] || fileName;
    return cleanName.includes('.') ? cleanName.split('.').pop()?.toLowerCase() || '' : '';
}

function isPdf(context: UniversalDocumentViewerContext): boolean {
    return context.contentType === 'application/pdf' || context.extension === 'pdf';
}

function isMarkdown(context: UniversalDocumentViewerContext): boolean {
    return (
        ['md', 'markdown'].includes(context.extension) ||
        ['text/markdown', 'text/x-markdown'].includes(context.contentType || '')
    );
}

function isImage(context: UniversalDocumentViewerContext): boolean {
    return (
        context.contentType?.startsWith('image/') ||
        ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(context.extension)
    );
}

function isHtml(context: UniversalDocumentViewerContext): boolean {
    return context.contentType === 'text/html' || ['html', 'htm'].includes(context.extension);
}

function isXml(context: UniversalDocumentViewerContext): boolean {
    return ['application/xml', 'text/xml'].includes(context.contentType || '') || context.extension === 'xml';
}

function isCodeOrText(context: UniversalDocumentViewerContext): boolean {
    return (
        context.contentType?.startsWith('text/') ||
        ['css', 'csv', 'json', 'txt', 'tsx', 'ts', 'jsx', 'js', 'xml', 'yaml', 'yml'].includes(context.extension)
    );
}

function canUsePdfRendition(context: UniversalDocumentViewerContext): boolean {
    return (
        ['doc', 'docx', 'ppt', 'pptx'].includes(context.extension) ||
        [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ].includes(context.contentType || '')
    );
}

function CodeViewer({ content, extension }: { content?: string; extension: string }) {
    return (
        <pre className="h-full overflow-auto rounded-md bg-muted/10 p-3 text-xs leading-5">
            <code className={extension ? `language-${extension}` : undefined}>{content || ''}</code>
        </pre>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-muted">
            <FileIcon className="size-8" />
            <span className="text-sm">{message}</span>
        </div>
    );
}

function renderWithCustomRenderer(
    renderer: UniversalDocumentRenderer,
    context: UniversalDocumentViewerContext,
): ReactNode {
    if (renderer.Component) {
        const RendererComponent = renderer.Component;
        return <RendererComponent context={context} />;
    }
    return renderer.render?.(context) ?? null;
}

export function UniversalDocumentViewer({
    source,
    className,
    bodyClassName,
    renderers = [],
    converters = [],
    resolveUrl,
    loadText,
    createRendition,
    markdownComponents,
    showHeader = true,
    onDownload,
}: UniversalDocumentViewerProps) {
    const { client } = useUserSession();
    const fileName = useMemo(() => getFileName(source), [source]);
    const extension = useMemo(() => getExtension(fileName), [fileName]);
    const [url, setUrl] = useState(source.url);
    const [content, setContent] = useState(source.content);
    const [rendition, setRendition] = useState<UniversalDocumentRendition | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const sourceKey = [
        source.id,
        source.title,
        source.fileName,
        source.contentType,
        source.url,
        source.sourcePath,
        source.content,
        source.artifact?.runId,
        source.artifact?.path,
    ].join('\0');

    const defaultResolveUrl = useCallback(
        async (currentSource: UniversalDocumentSource, disposition: 'inline' | 'attachment') => {
            if (currentSource.url) return currentSource.url;
            if (currentSource.artifact) {
                const result = await client.files.getArtifactDownloadUrl(
                    currentSource.artifact.runId,
                    currentSource.artifact.path,
                    disposition,
                );
                return result.url;
            }
            if (currentSource.sourcePath) {
                const result = await client.files.getDownloadUrl(
                    currentSource.sourcePath,
                    currentSource.fileName,
                    disposition,
                );
                return result.url;
            }
            return '';
        },
        [client],
    );

    const resolveDocumentUrl = resolveUrl || defaultResolveUrl;

    const defaultLoadText = useCallback(
        async (currentSource: UniversalDocumentSource) => {
            if (currentSource.content !== undefined) return currentSource.content;
            const resolvedUrl = await resolveDocumentUrl(currentSource, 'inline');
            if (!resolvedUrl) return '';
            const response = await fetch(resolvedUrl);
            if (!response.ok) {
                throw new Error(`Failed to load ${getFileName(currentSource)}: ${response.statusText}`);
            }
            return response.text();
        },
        [resolveDocumentUrl],
    );

    const loadDocumentText = loadText || defaultLoadText;

    const baseContext: UniversalDocumentViewerContext = {
        source,
        fileName,
        extension,
        contentType: source.contentType || rendition?.contentType,
        url: rendition?.url || url,
        content: rendition?.content || content,
        isLoading,
        error,
        reload: () => setRefreshKey((key) => key + 1),
    };

    const selectedCustomRenderer = renderers.find((renderer) => renderer.canRender(baseContext));
    const needsText =
        !selectedCustomRenderer &&
        (isMarkdown(baseContext) || isHtml(baseContext) || isXml(baseContext) || isCodeOrText(baseContext));
    const needsUrl = !selectedCustomRenderer && (isPdf(baseContext) || isImage(baseContext));
    const converterContext: UniversalDocumentConverterContext = {
        source,
        fileName,
        extension,
        contentType: source.contentType,
        target: 'pdf',
    };
    const selectedConverter =
        !selectedCustomRenderer && !baseContext.url
            ? converters.find((converter) => converter.target === 'pdf' && converter.canConvert(converterContext))
            : undefined;
    const needsPdfRendition =
        !selectedCustomRenderer &&
        !baseContext.url &&
        (canUsePdfRendition(baseContext) || !!selectedConverter) &&
        (!!selectedConverter || !!createRendition);

    useEffect(() => {
        let cancelled = false;
        // These values intentionally retrigger loading even when source object identity is stable.
        void refreshKey;
        void sourceKey;
        const currentSource = source;
        setError(null);
        setUrl(currentSource.url);
        setContent(currentSource.content);
        setRendition(null);

        async function load() {
            if (!needsText && !needsUrl && !needsPdfRendition) return;
            setIsLoading(true);
            try {
                if (needsPdfRendition) {
                    const result = selectedConverter
                        ? await selectedConverter.convert({
                              source: currentSource,
                              fileName,
                              extension,
                              contentType: currentSource.contentType,
                              target: 'pdf',
                          })
                        : await createRendition?.(currentSource, 'pdf');
                    if (!cancelled) setRendition(result ?? null);
                    return;
                }

                if (needsText) {
                    const result = await loadDocumentText(currentSource);
                    if (!cancelled) setContent(result);
                    return;
                }

                if (needsUrl) {
                    const result = await resolveDocumentUrl(currentSource, 'inline');
                    if (!cancelled) setUrl(result);
                }
            } catch (err: unknown) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load document');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [
        createRendition,
        extension,
        fileName,
        loadDocumentText,
        needsPdfRendition,
        needsText,
        needsUrl,
        refreshKey,
        resolveDocumentUrl,
        selectedConverter,
        source,
        sourceKey,
    ]);

    const context: UniversalDocumentViewerContext = {
        ...baseContext,
        url: rendition?.url || url,
        content: rendition?.content || content,
        contentType: rendition?.contentType || source.contentType,
        isLoading,
        error,
    };

    let body: ReactNode;
    if (isLoading) {
        body = (
            <div className="flex h-full min-h-64 items-center justify-center gap-2 text-muted">
                <Loader2Icon className="size-5 animate-spin" />
                <span className="text-sm">Loading preview...</span>
            </div>
        );
    } else if (error) {
        body = (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-destructive">
                <AlertCircleIcon className="size-7" />
                <span className="max-w-xl text-center text-sm">{error}</span>
                <Button variant="outline" size="sm" onClick={context.reload}>
                    Retry
                </Button>
            </div>
        );
    } else if (selectedCustomRenderer) {
        body = renderWithCustomRenderer(selectedCustomRenderer, context);
    } else if ((isPdf(context) || rendition?.contentType === 'application/pdf') && context.url) {
        body = <SimplePdfViewer url={context.url} className="h-full" />;
    } else if (isImage(context) && context.url) {
        body = (
            <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-muted/10 p-3">
                <img src={context.url} alt={fileName} className="max-h-full max-w-full rounded-md object-contain" />
            </div>
        );
    } else if (isMarkdown(context)) {
        body = (
            <div className="prose prose-sm dark:prose-invert max-w-none px-5 py-4">
                <MarkdownRenderer artifactRunId={source.artifact?.runId} components={markdownComponents}>
                    {context.content || ''}
                </MarkdownRenderer>
            </div>
        );
    } else if (isHtml(context)) {
        body = (
            <iframe
                title={fileName}
                className="h-full min-h-96 w-full bg-white"
                sandbox=""
                srcDoc={context.content || ''}
            />
        );
    } else if (isXml(context)) {
        body = (
            <div className="px-4 py-2">
                <XMLViewer xml={context.content || ''} collapsible />
            </div>
        );
    } else if (isCodeOrText(context)) {
        body = <CodeViewer content={context.content} extension={extension} />;
    } else if (canUsePdfRendition(context) && !selectedConverter && !createRendition) {
        body = <EmptyState message="This file needs a PDF rendition before it can be previewed." />;
    } else {
        body = <EmptyState message="Preview is not available for this file type." />;
    }

    return (
        <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
            {showHeader && (
                <div className="flex min-h-10 items-center justify-between gap-3 border-b py-2 ps-3 pe-16">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium" title={fileName}>
                            {fileName}
                        </div>
                        {context.contentType && (
                            <div className="truncate text-xs text-muted">{context.contentType}</div>
                        )}
                    </div>
                    {onDownload && (
                        <Button variant="outline" size="sm" onClick={() => onDownload(source)}>
                            Download
                        </Button>
                    )}
                </div>
            )}
            <div className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}>{body}</div>
        </div>
    );
}
