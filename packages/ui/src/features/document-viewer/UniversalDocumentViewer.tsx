import { Badge, Button, cn } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { MarkdownRenderer, type MarkdownRendererProps, XMLViewer } from '@vertesia/ui/widgets';
import { AlertCircleIcon, FileIcon, ImageIcon, Loader2Icon } from 'lucide-react';
import { type ComponentType, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
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

function isTsxMockupSource(context: UniversalDocumentViewerContext): boolean {
    return ['tsx', 'jsx'].includes(context.extension);
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

interface TsxRenderMetadata {
    ok?: boolean;
    source_artifact?: string;
    screenshot_artifact?: string;
    rendered_at?: string;
    viewport?: {
        width?: number;
        height?: number;
    };
    dependencies_reused?: boolean;
    status?: number;
    title?: string;
    console_errors?: unknown[];
    page_errors?: unknown[];
    failed_requests?: unknown[];
    bad_responses?: unknown[];
    timings_ms?: Record<string, unknown>;
    error?: unknown;
}

interface TsxSandboxPreviewState {
    isLoading: boolean;
    imageUrl?: string;
    metadata?: TsxRenderMetadata;
    previewError?: string;
    metadataError?: string;
}

function replaceExtension(path: string, nextExtension: string): string {
    return path.includes('.') ? path.replace(/\.[^/.]+$/, nextExtension) : `${path}${nextExtension}`;
}

function fileNameFromPath(path: string): string {
    return path.split('/').pop() || path;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function formatDuration(ms: number | undefined): string | undefined {
    if (ms === undefined) return undefined;
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
}

function countItems(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
}

function parseTsxRenderMetadata(text: string): TsxRenderMetadata | undefined {
    try {
        const parsed = JSON.parse(text) as unknown;
        const record = asRecord(parsed);
        if (!record) return undefined;
        const viewport = asRecord(record.viewport);
        return {
            ok: typeof record.ok === 'boolean' ? record.ok : undefined,
            source_artifact: typeof record.source_artifact === 'string' ? record.source_artifact : undefined,
            screenshot_artifact:
                typeof record.screenshot_artifact === 'string' ? record.screenshot_artifact : undefined,
            rendered_at: typeof record.rendered_at === 'string' ? record.rendered_at : undefined,
            viewport: viewport
                ? {
                      width: asNumber(viewport.width),
                      height: asNumber(viewport.height),
                  }
                : undefined,
            dependencies_reused:
                typeof record.dependencies_reused === 'boolean' ? record.dependencies_reused : undefined,
            status: asNumber(record.status),
            title: typeof record.title === 'string' ? record.title : undefined,
            console_errors: Array.isArray(record.console_errors) ? record.console_errors : undefined,
            page_errors: Array.isArray(record.page_errors) ? record.page_errors : undefined,
            failed_requests: Array.isArray(record.failed_requests) ? record.failed_requests : undefined,
            bad_responses: Array.isArray(record.bad_responses) ? record.bad_responses : undefined,
            timings_ms: asRecord(record.timings_ms),
            error: record.error,
        };
    } catch {
        return undefined;
    }
}

async function fetchText(url: string, fileName: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${fileName}: ${response.statusText}`);
    }
    return response.text();
}

function resolveScreenshotPath({
    metadata,
    sourcePath,
    fallbackPath,
    artifactMode,
}: {
    metadata?: TsxRenderMetadata;
    sourcePath: string;
    fallbackPath: string;
    artifactMode: boolean;
}): string {
    const screenshotArtifact = metadata?.screenshot_artifact?.replace(/^\/+/, '');
    if (!screenshotArtifact) return fallbackPath;
    if (artifactMode) return screenshotArtifact;

    const sourceArtifact = metadata?.source_artifact?.replace(/^\/+/, '');
    const normalizedSourcePath = sourcePath.replace(/^\/+/, '');
    if (sourceArtifact && normalizedSourcePath.endsWith(sourceArtifact)) {
        const storageRoot = normalizedSourcePath.slice(0, -sourceArtifact.length).replace(/\/+$/, '');
        return storageRoot ? `${storageRoot}/${screenshotArtifact}` : screenshotArtifact;
    }

    const sourceDir = normalizedSourcePath.includes('/')
        ? normalizedSourcePath.slice(0, normalizedSourcePath.lastIndexOf('/') + 1)
        : '';
    return sourceDir ? `${sourceDir}${fileNameFromPath(screenshotArtifact)}` : fallbackPath;
}

function TsxRenderDetails({ metadata }: { metadata?: TsxRenderMetadata }) {
    if (!metadata) return null;

    const totalMs = asNumber(metadata.timings_ms?.total_before_cleanup);
    const issueCount =
        countItems(metadata.console_errors) +
        countItems(metadata.page_errors) +
        countItems(metadata.failed_requests) +
        countItems(metadata.bad_responses);

    return (
        <div className="grid gap-2 border-b p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
                {metadata.ok !== undefined && (
                    <Badge variant={metadata.ok ? 'success' : 'destructive'}>
                        {metadata.ok ? 'render ok' : 'render failed'}
                    </Badge>
                )}
                {metadata.dependencies_reused !== undefined && (
                    <Badge variant={metadata.dependencies_reused ? 'info' : 'secondary'}>
                        deps {metadata.dependencies_reused ? 'reused' : 'installed'}
                    </Badge>
                )}
                {metadata.status && <Badge variant="secondary">HTTP {metadata.status}</Badge>}
                {issueCount > 0 && <Badge variant="attention">{issueCount} browser issue(s)</Badge>}
            </div>
            <div className="grid gap-1 text-muted sm:grid-cols-2">
                {metadata.viewport?.width && metadata.viewport.height && (
                    <div>
                        Viewport {metadata.viewport.width} x {metadata.viewport.height}
                    </div>
                )}
                {formatDuration(totalMs) && <div>Total {formatDuration(totalMs)}</div>}
                {metadata.rendered_at && <div>Rendered {new Date(metadata.rendered_at).toLocaleString()}</div>}
                {metadata.title && <div className="truncate">Title {metadata.title}</div>}
            </div>
            {typeof metadata.error === 'string' && <div className="text-destructive">{metadata.error}</div>}
        </div>
    );
}

function TsxSandboxRenderPreview({ context }: { context: UniversalDocumentViewerContext }) {
    const { client } = useUserSession();
    const artifact = context.source.artifact;
    const sourcePath = artifact?.path || context.source.sourcePath;
    const artifactMode = !!artifact;
    const code = context.content || '';
    const [state, setState] = useState<TsxSandboxPreviewState>({ isLoading: false });

    const getRelatedUrl = useCallback(
        async (path: string, disposition: 'inline' | 'attachment') => {
            if (artifact) {
                const result = await client.files.getArtifactDownloadUrl(artifact.runId, path, disposition);
                return result.url;
            }
            const result = await client.files.getDownloadUrl(path, fileNameFromPath(path), disposition);
            return result.url;
        },
        [artifact, client],
    );

    useEffect(() => {
        if (!sourcePath) {
            setState({ isLoading: false, previewError: 'No source path is available for this TSX artifact.' });
            return;
        }
        const currentSourcePath: string = sourcePath;

        let cancelled = false;
        const pngPath = replaceExtension(currentSourcePath, '.png');
        const metadataPath = replaceExtension(currentSourcePath, '.render.json');

        async function loadPreview() {
            setState({ isLoading: true });

            let metadata: TsxRenderMetadata | undefined;
            let metadataError: string | undefined;
            let imagePath = pngPath;

            try {
                const metadataUrl = await getRelatedUrl(metadataPath, 'inline');
                metadata = parseTsxRenderMetadata(await fetchText(metadataUrl, fileNameFromPath(metadataPath)));
                imagePath = resolveScreenshotPath({
                    metadata,
                    sourcePath: currentSourcePath,
                    fallbackPath: pngPath,
                    artifactMode,
                });
            } catch (err: unknown) {
                metadataError = err instanceof Error ? err.message : 'Render metadata is not available';
            }

            let imageUrl: string | undefined;
            let previewError: string | undefined;
            try {
                imageUrl = await getRelatedUrl(imagePath, 'inline');
            } catch (err: unknown) {
                previewError = err instanceof Error ? err.message : 'Sandbox render image is not available';
            }

            if (!cancelled) {
                setState({
                    isLoading: false,
                    imageUrl,
                    metadata,
                    metadataError,
                    previewError,
                });
            }
        }

        void loadPreview();
        return () => {
            cancelled = true;
        };
    }, [artifactMode, getRelatedUrl, sourcePath]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex min-h-10 flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
                <ImageIcon className="size-4 text-info" />
                <span className="font-medium">Sandbox render</span>
                {state.isLoading ? (
                    <Badge variant="secondary">loading</Badge>
                ) : state.imageUrl ? (
                    <Badge variant="success">PNG preview</Badge>
                ) : (
                    <Badge variant="attention">source only</Badge>
                )}
                {state.metadata?.rendered_at && (
                    <span className="text-xs text-muted">{new Date(state.metadata.rendered_at).toLocaleString()}</span>
                )}
            </div>

            {state.isLoading ? (
                <div className="flex h-full min-h-64 items-center justify-center gap-2 text-muted">
                    <Loader2Icon className="size-5 animate-spin" />
                    <span className="text-sm">Loading sandbox render...</span>
                </div>
            ) : state.imageUrl ? (
                <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.7fr)]">
                    <div className="flex min-h-0 items-center justify-center overflow-auto bg-muted/10 p-3">
                        <img
                            src={state.imageUrl}
                            alt={`${context.fileName} sandbox render`}
                            className="max-h-full max-w-full rounded-md object-contain"
                        />
                    </div>
                    <div className="min-h-0 overflow-auto border-t xl:border-s xl:border-t-0">
                        <TsxRenderDetails metadata={state.metadata} />
                        <div className="p-3">
                            <CodeViewer content={code} extension={context.extension} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
                    <div className="border-b px-3 py-2 text-xs text-muted">
                        No sandbox-rendered PNG was found for this TSX artifact. Showing the source without executing it
                        in Studio.
                        {state.previewError && <span className="ms-1">Preview lookup: {state.previewError}</span>}
                        {!state.previewError && state.metadataError && (
                            <span className="ms-1">Metadata lookup: {state.metadataError}</span>
                        )}
                    </div>
                    <div className="min-h-0 overflow-auto p-3">
                        <TsxRenderDetails metadata={state.metadata} />
                        <CodeViewer content={code} extension={context.extension} />
                    </div>
                </div>
            )}
        </div>
    );
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
    } else if (isTsxMockupSource(context)) {
        body = <TsxSandboxRenderPreview context={context} />;
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
