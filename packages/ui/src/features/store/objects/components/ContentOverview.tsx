import {
    ContentNature,
    type ContentObject,
    ContentObjectStatus,
    type ContentObjectTypeItem,
    type DocAnalyzerProgress,
    type DocProcessorOutputFormat,
    type DocumentMetadata,
    MarkdownRenditionFormat,
    PDF_RENDITION_NAME,
    Permission,
    WorkflowExecutionStatus,
} from '@vertesia/common';
import {
    Button,
    Dropdown,
    MenuItem,
    Portal,
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
    Spinner,
    useFetch,
    useToast,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { NavLink } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { JSONDisplay, MarkdownRenderer, Progress, XMLViewer } from '@vertesia/ui/widgets';
import { AlertTriangle, Copy, Download, FileSearch, SquarePen } from 'lucide-react';
import { memo, type RefObject, useEffect, useRef, useState } from 'react';
import { MagicPdfView } from '../../../magic-pdf';
import { GroundedExtractionPanel, useGroundedExtractionAvailable } from '../../../magic-pdf/GroundedExtractionView.js';
import { AudioPanel, ImagePanel, VideoPanel } from '../../../media-viewer';
import { SimplePdfViewer } from '../../../pdf-viewer';
import { SecureButton } from '../../../permissions/SecureButton.js';
import { getWorkflowStatusColor, getWorkflowStatusName, isPreviewableAsPdf } from '../../../utils/index.js';
import { resolveTypeCached } from '../../types/typeCatalogCache.js';
import { PropertiesEditorModal } from './PropertiesEditorModal';
import { TextEditorPanel } from './TextEditorPanel.js';
import { useObjectText, useOfficePdfConversion, usePdfProcessingStatus } from './useContentPanelHooks.js';
import { useDownloadFile } from './useDownloadFile.js';

// ----- Type Definitions -----

interface TextActionsProps {
    object: ContentObject;
    text: string | undefined;
    fullText: string | undefined;
    handleCopyContent: (content: string, type: 'text' | 'properties') => Promise<void>;
    textContainerRef: RefObject<HTMLDivElement | null>;
    isEditing?: boolean;
    onToggleEdit?: () => void;
    canEdit?: boolean;
}

interface TextPanelProps {
    object: ContentObject;
    text: string | undefined;
    isTextCropped: boolean;
    textContainerRef: RefObject<HTMLDivElement | null>;
}

interface OfficePdfPreviewPanelProps {
    pdfRendition?: { content?: { source?: string } };
    officePdfUrl?: string;
    officePdfConverting: boolean;
    officePdfError?: string;
    onConvert: () => void;
}

interface OfficePdfActionsProps {
    object: ContentObject;
    pdfRendition?: { name: string; content: { source?: string } };
    officePdfUrl?: string;
}

// ----- Markdown Components Configuration -----

/** Common props for markdown component overrides */
interface MarkdownComponentProps {
    node?: unknown;
    children?: React.ReactNode;
}

/**
 * Custom markdown components for the content overview.
 * Handles internal links to store objects and provides consistent styling.
 */
const createMarkdownComponents = () => ({
    a: ({ node, ...props }: MarkdownComponentProps & { href?: string }) => {
        const href = props.href || '';
        if (href.includes('/store/objects/')) {
            return (
                <NavLink topLevelNav href={href} className="text-info">
                    {props.children}
                </NavLink>
            );
        }
        return <a {...props} target="_blank" rel="noopener noreferrer" />;
    },
    p: ({ node, ...props }: MarkdownComponentProps) => <p {...props} className="my-0" />,
    pre: ({ node, ...props }: MarkdownComponentProps) => <pre {...props} className="my-2 p-2 rounded" />,
    code: ({ node, className, children, ...props }: MarkdownComponentProps & { className?: string }) => {
        const match = /language-(\w+)/.exec(className || '');
        const isInline = !match;
        return (
            <code {...props} className={isInline ? 'px-1.5 py-0.5 rounded' : 'text-muted'}>
                {children}
            </code>
        );
    },
    h1: ({ node, ...props }: MarkdownComponentProps) => <h1 {...props} className="font-bold text-2xl my-2" />,
    h2: ({ node, ...props }: MarkdownComponentProps) => <h2 {...props} className="font-bold text-xl my-2" />,
    h3: ({ node, ...props }: MarkdownComponentProps) => <h3 {...props} className="font-bold text-lg my-2" />,
    li: ({ node, ...props }: MarkdownComponentProps) => <li {...props} />,
});

/**
 * Check if an object is in created or processing status.
 */
function isCreatedOrProcessingStatus(status?: ContentObjectStatus): boolean {
    return status === ContentObjectStatus.created || status === ContentObjectStatus.processing;
}

/**
 * Get the content processor type from object metadata.
 */
function getContentProcessorType(object: ContentObject): string | undefined {
    return (object.metadata as DocumentMetadata)?.content_processor?.type;
}

/**
 * Check if text content appears to be markdown based on common patterns.
 */
function looksLikeMarkdown(text: string | undefined): boolean {
    if (!text) return false;
    return (
        text.includes('\n# ') ||
        text.includes('\n## ') ||
        text.includes('\n### ') ||
        text.includes('\n* ') ||
        text.includes('\n- ') ||
        text.includes('\n+ ') ||
        text.includes('![') ||
        text.includes('](')
    );
}

/**
 * Helper function to get panel visibility className.
 * Returns empty string if visible, 'hidden' if not visible.
 */
function getPanelVisibility(isVisible: boolean): string {
    return isVisible ? 'h-full overflow-auto' : 'hidden';
}

enum PanelView {
    Text = 'text',
    Image = 'image',
    Video = 'video',
    Audio = 'audio',
    Pdf = 'pdf',
    Transcript = 'transcript',
    Grounded = 'grounded',
}

interface ContentOverviewProps {
    object: ContentObject;
    loadText?: boolean;
    refetch?: () => Promise<unknown>;
    canEditProperties?: boolean;
}
export function ContentOverview({ object, loadText, refetch, canEditProperties = true }: ContentOverviewProps) {
    const toast = useToast();
    const { t } = useUITranslation();

    const handleCopyContent = async (content: string, type: 'text' | 'properties') => {
        try {
            await navigator.clipboard.writeText(content);
            toast({
                status: 'success',
                title: t('store.contentCopied', {
                    type: type === 'text' ? t('store.contentType') : t('store.properties'),
                }),
                description: t('store.successfullyCopied', { type }),
                duration: 2000,
            });
        } catch (err) {
            console.error(`Failed to copy ${type}:`, err);
            toast({
                status: 'error',
                title: t('store.copyFailed'),
                description: t('store.failedToCopy', { type }),
                duration: 5000,
            });
        }
    };

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={67} className="min-w-[100px]">
                <DataPanel
                    object={object}
                    loadText={loadText ?? false}
                    handleCopyContent={handleCopyContent}
                    refetch={refetch}
                />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={33} className="min-w-[100px]">
                <PropertiesPanel
                    object={object}
                    refetch={refetch ?? (() => Promise.resolve())}
                    handleCopyContent={handleCopyContent}
                    canEditProperties={canEditProperties}
                />
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}

function PropertiesPanel({
    object,
    refetch,
    handleCopyContent,
    canEditProperties,
}: {
    object: ContentObject;
    refetch: () => Promise<unknown>;
    handleCopyContent: (content: string, type: 'text' | 'properties') => Promise<void>;
    canEditProperties: boolean;
}) {
    const { t } = useUITranslation();
    const [viewCode, setViewCode] = useState(false);
    const [isPropertiesModalOpen, setPropertiesModalOpen] = useState(false);

    const handleOpenPropertiesModal = () => {
        setPropertiesModalOpen(true);
    };

    const handleClosePropertiesModal = () => {
        setPropertiesModalOpen(false);
    };

    return (
        <>
            <div className="flex flex-col h-full">
                <div className="flex justify-between items-center px-2">
                    <div className="flex items-center gap-1 bg-muted mb-2 p-1 rounded">
                        <Button
                            variant={`${viewCode ? 'ghost' : 'primary'}`}
                            size="sm"
                            alt={t('store.previewProperties')}
                            onClick={() => setViewCode(!viewCode)}
                        >
                            Properties
                        </Button>
                        <Button
                            variant={`${viewCode ? 'primary' : 'ghost'}`}
                            size="sm"
                            alt={t('store.viewInJsonFormat')}
                            onClick={() => setViewCode(!viewCode)}
                        >
                            JSON
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        {object.properties && (
                            <Button
                                variant="ghost"
                                size="sm"
                                title="Copy properties"
                                onClick={() =>
                                    handleCopyContent(JSON.stringify(object.properties, null, 2), 'properties')
                                }
                            >
                                <Copy className="size-4" />
                            </Button>
                        )}
                        {canEditProperties && (
                            <SecureButton
                                permission={Permission.content_write}
                                variant="ghost"
                                size="sm"
                                onClick={handleOpenPropertiesModal}
                                title="Edit properties"
                                className="flex items-center gap-2"
                            >
                                <SquarePen className="size-4" />
                            </SecureButton>
                        )}
                    </div>
                </div>

                {object.properties ? (
                    <div className="flex-1 min-h-0 px-2">
                        <JSONDisplay value={object.properties} viewCode={viewCode} />
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 px-2">
                        <div>{t('store.noPropertiesDefined')}</div>
                    </div>
                )}
            </div>
            <PropertiesEditorModal
                isOpen={isPropertiesModalOpen}
                onClose={handleClosePropertiesModal}
                object={object}
                refetch={refetch}
            />
        </>
    );
}

type IntakeDefaultView = NonNullable<NonNullable<ContentObjectTypeItem['intake']>['default_view']>;

interface DataPanelProps {
    object: ContentObject;
    loadText: boolean;
    handleCopyContent: (content: string, type: 'text' | 'properties') => Promise<void>;
    refetch?: () => Promise<unknown>;
}

/**
 * Resolves the object's content-type intake policy BEFORE the initial panel is chosen so
 * `default_view` can drive it. Renders a spinner until the type is resolved — never the
 * MIME-guessed panel first (no guess-then-flip). Objects without a type render immediately.
 */
function DataPanel(props: DataPanelProps) {
    const { client } = useUserSession();
    const typeRef = props.object.type;
    const typeId = typeRef?.id;
    // Fast path: single-object reads carry the display hint on the API-enriched type ref.
    const refView = typeRef?.default_view;
    // Fallback (list-fed contexts, older servers): session-cached catalog lookup.
    // null = resolved with no default view; undefined = not resolved yet.
    const { data: fetchedView } = useFetch<IntakeDefaultView | null>(async () => {
        if (!typeId || refView) return null;
        const type = await resolveTypeCached(client, typeId);
        return type?.intake?.default_view ?? null;
    }, [typeId, refView]);
    const defaultView = refView ?? fetchedView;
    if (typeId && !refView && fetchedView === undefined) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }
    return <DataPanelContent {...props} defaultView={defaultView ?? undefined} />;
}

function DataPanelContent({
    object,
    loadText,
    handleCopyContent,
    refetch,
    defaultView,
}: DataPanelProps & { defaultView?: IntakeDefaultView }) {
    const { t } = useUITranslation();
    const isImage = object?.metadata?.type === ContentNature.Image;
    const isVideo = object?.metadata?.type === ContentNature.Video;
    const isAudio = object?.metadata?.type === ContentNature.Audio;
    const isPdf = object?.content?.type === 'application/pdf';
    const isPreviewableAsPdfDoc = object?.content?.type ? isPreviewableAsPdf(object.content.type) : false;
    const isCreatedOrProcessing = isCreatedOrProcessingStatus(object?.status);
    const hasTranscript = !!(object.transcript && (isVideo || isAudio));

    // Check if PDF rendition exists for Office documents
    const metadata = object.metadata as DocumentMetadata;
    const pdfRendition = metadata?.renditions?.find((r) => r.name === PDF_RENDITION_NAME);

    // Determine initial panel view: the type's default_view wins when it applies to this
    // object; otherwise fall back to the nature/MIME heuristics.
    const getInitialView = (): PanelView => {
        switch (defaultView) {
            case 'text':
                return PanelView.Text;
            case 'pdf':
                if (isPdf || isPreviewableAsPdfDoc || pdfRendition) return PanelView.Pdf;
                break;
            case 'image':
                if (isImage) return PanelView.Image;
                break;
            case 'properties':
                // Properties live in the right-hand panel which is always visible; the text
                // panel shows the rendered property card for extraction-only types.
                return PanelView.Text;
            default:
                break;
        }
        if (isVideo) return PanelView.Video;
        if (isAudio) return PanelView.Audio;
        if (isImage) return PanelView.Image;
        return PanelView.Text;
    };

    const groundedAvailable = useGroundedExtractionAvailable(object.id);
    const [currentPanel, setCurrentPanel] = useState<PanelView>(getInitialView());
    const [hasVisitedPdfPanel, setHasVisitedPdfPanel] = useState(currentPanel === PanelView.Pdf);

    useEffect(() => {
        if (currentPanel === PanelView.Pdf) {
            setHasVisitedPdfPanel(true);
        }
    }, [currentPanel]);

    // Text editing state
    const [isEditing, setIsEditing] = useState(false);
    const canEdit = !!(
        object.content?.source &&
        object.content?.type &&
        !isCreatedOrProcessing &&
        !object.is_locked &&
        object.user_permissions?.can_write !== false &&
        (object.content.type.startsWith('text/') ||
            object.content.type === 'application/json' ||
            object.content.type === 'application/xml')
    );

    // Use custom hooks for text loading, PDF processing, and Office conversion
    const {
        fullText,
        displayText,
        isLoading: isLoadingText,
        isCropped: isTextCropped,
        loadText: reloadText,
    } = useObjectText(object.id, object.text, loadText);

    // Only poll while the active panel can actually surface processing progress.
    const shouldPollProgress =
        (isPdf || isPreviewableAsPdfDoc) &&
        isCreatedOrProcessing &&
        (currentPanel === PanelView.Text || currentPanel === PanelView.Pdf);
    const {
        progress: pdfProgress,
        status: pdfStatus,
        outputFormat: pdfOutputFormat,
        isComplete: processingComplete,
    } = usePdfProcessingStatus(object.id, shouldPollProgress);

    // Office document PDF conversion
    const {
        pdfUrl: officePdfUrl,
        isConverting: officePdfConverting,
        error: officePdfError,
        triggerConversion: triggerOfficePdfConversion,
    } = useOfficePdfConversion(object.id, isPreviewableAsPdfDoc);

    // Load text once processing completes without triggering a full object refetch
    // (which would flash the page-level loading spinner).
    useEffect(() => {
        if (processingComplete && pdfStatus === WorkflowExecutionStatus.COMPLETED) {
            reloadText();
        }
    }, [processingComplete, pdfStatus, reloadText]);

    // Show processing panel when workflow is running (for both PDFs and Office documents)
    const showProcessingPanel =
        (isPdf || isPreviewableAsPdfDoc) &&
        isCreatedOrProcessing &&
        !processingComplete &&
        pdfStatus === WorkflowExecutionStatus.RUNNING;
    const showPdfPreviewPanel = currentPanel === PanelView.Pdf && !showProcessingPanel;
    const showPdfProcessingPanel =
        showProcessingPanel && (currentPanel === PanelView.Text || currentPanel === PanelView.Pdf);
    const keepPdfPreviewMounted = hasVisitedPdfPanel && !showProcessingPanel;

    const textContainerRef = useRef<HTMLDivElement | null>(null);

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center px-2 shrink-0">
                <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1 bg-muted p-1 rounded">
                        {isImage && (
                            <Button
                                variant={currentPanel === PanelView.Image ? 'primary' : 'ghost'}
                                size="sm"
                                alt={t('store.viewImage')}
                                onClick={() => setCurrentPanel(PanelView.Image)}
                            >
                                Image
                            </Button>
                        )}
                        {isVideo && (
                            <Button
                                variant={currentPanel === PanelView.Video ? 'primary' : 'ghost'}
                                size="sm"
                                alt={t('store.viewVideo')}
                                onClick={() => setCurrentPanel(PanelView.Video)}
                            >
                                Video
                            </Button>
                        )}
                        {isAudio && (
                            <Button
                                variant={currentPanel === PanelView.Audio ? 'primary' : 'ghost'}
                                size="sm"
                                alt={t('store.viewAudio')}
                                onClick={() => setCurrentPanel(PanelView.Audio)}
                            >
                                Audio
                            </Button>
                        )}
                        {hasTranscript && (
                            <Button
                                variant={currentPanel === PanelView.Transcript ? 'primary' : 'ghost'}
                                size="sm"
                                alt={t('store.viewTranscript')}
                                onClick={() => setCurrentPanel(PanelView.Transcript)}
                            >
                                Transcript
                            </Button>
                        )}
                        <Button
                            variant={currentPanel === PanelView.Text ? 'primary' : 'ghost'}
                            size="sm"
                            alt={t('store.viewText')}
                            onClick={() => setCurrentPanel(PanelView.Text)}
                        >
                            Text
                        </Button>
                        {isPdf && (
                            <Button
                                variant={currentPanel === PanelView.Pdf ? 'primary' : 'ghost'}
                                size="sm"
                                alt={t('store.viewPdf')}
                                onClick={() => setCurrentPanel(PanelView.Pdf)}
                            >
                                PDF
                            </Button>
                        )}
                        {isPreviewableAsPdfDoc && (
                            <Button
                                variant={currentPanel === PanelView.Pdf ? 'primary' : 'ghost'}
                                size="sm"
                                alt={t('store.viewAsPdf')}
                                onClick={() => {
                                    setCurrentPanel(PanelView.Pdf);
                                    if (!pdfRendition && !officePdfUrl && !officePdfConverting) {
                                        void triggerOfficePdfConversion();
                                    }
                                }}
                                disabled={officePdfConverting}
                            >
                                {officePdfConverting ? <Spinner size="sm" /> : 'PDF'}
                            </Button>
                        )}
                        {groundedAvailable && (
                            <Button
                                variant={currentPanel === PanelView.Grounded ? 'primary' : 'ghost'}
                                size="sm"
                                alt={t('grounded.title')}
                                onClick={() => setCurrentPanel(PanelView.Grounded)}
                            >
                                Grounded
                            </Button>
                        )}
                    </div>
                    <PdfActions object={object} />
                </div>
                {currentPanel === PanelView.Text && !showProcessingPanel && !isEditing && (
                    <TextActions
                        object={object}
                        text={displayText}
                        fullText={fullText}
                        handleCopyContent={handleCopyContent}
                        textContainerRef={textContainerRef}
                        isEditing={isEditing}
                        onToggleEdit={() => setIsEditing(true)}
                        canEdit={canEdit}
                    />
                )}
                {currentPanel === PanelView.Pdf && isPreviewableAsPdfDoc && (pdfRendition || officePdfUrl) && (
                    <OfficePdfActions object={object} pdfRendition={pdfRendition} officePdfUrl={officePdfUrl} />
                )}
            </div>
            {currentPanel === PanelView.Grounded && (
                <div className={getPanelVisibility(true)}>
                    <GroundedExtractionPanel objectId={object.id} />
                </div>
            )}
            {currentPanel === PanelView.Image && (
                <div className={getPanelVisibility(true)}>
                    <ImagePanel object={object} />
                </div>
            )}
            {currentPanel === PanelView.Video && (
                <div className={getPanelVisibility(true)}>
                    <VideoPanel object={object} />
                </div>
            )}
            {currentPanel === PanelView.Audio && (
                <div className={getPanelVisibility(true)}>
                    <AudioPanel object={object} />
                </div>
            )}
            {hasTranscript && currentPanel === PanelView.Transcript && (
                <div className={getPanelVisibility(true)}>
                    <TranscriptPanel object={object} handleCopyContent={handleCopyContent} />
                </div>
            )}
            {isPdf && keepPdfPreviewMounted && (
                <div className={getPanelVisibility(showPdfPreviewPanel)}>
                    <PdfPreviewPanel object={object} />
                </div>
            )}
            {isPreviewableAsPdfDoc && keepPdfPreviewMounted && (
                <div className={getPanelVisibility(showPdfPreviewPanel)}>
                    <OfficePdfPreviewPanel
                        pdfRendition={pdfRendition}
                        officePdfUrl={officePdfUrl}
                        officePdfConverting={officePdfConverting}
                        officePdfError={officePdfError}
                        onConvert={triggerOfficePdfConversion}
                    />
                </div>
            )}
            {showPdfProcessingPanel && (
                <div className={getPanelVisibility(true)}>
                    <PdfProcessingPanel progress={pdfProgress} status={pdfStatus} outputFormat={pdfOutputFormat} />
                </div>
            )}
            {currentPanel === PanelView.Text && !showProcessingPanel && !isEditing && isLoadingText && (
                <div className={getPanelVisibility(true)}>
                    <div className="flex justify-center items-center flex-1">
                        <Spinner size="lg" />
                    </div>
                </div>
            )}
            {currentPanel === PanelView.Text && !showProcessingPanel && !isEditing && !isLoadingText && (
                <div className={getPanelVisibility(true)}>
                    <TextPanel
                        object={object}
                        text={displayText}
                        isTextCropped={isTextCropped}
                        textContainerRef={textContainerRef}
                    />
                </div>
            )}
            {isEditing && currentPanel === PanelView.Text && fullText != null && (
                <TextEditorPanel
                    object={object}
                    text={fullText}
                    onClose={() => setIsEditing(false)}
                    onSaved={() => {
                        setIsEditing(false);
                        reloadText();
                        void refetch?.();
                    }}
                />
            )}
        </div>
    );
}

function TextActions({ object, text, fullText, handleCopyContent, onToggleEdit, canEdit }: TextActionsProps) {
    const { client, project } = useUserSession();
    const toast = useToast();
    const { t } = useUITranslation();
    const content = object.content;
    const { renderDocument, isDownloading } = useDownloadFile({ client, toast });
    const { data: fullProject } = useFetch(
        () => (project ? client.projects.retrieve(project.id) : Promise.resolve(undefined)),
        [project?.id],
    );
    const pdfTemplateObjectId = fullProject?.configuration?.pdf_template_object_id;

    const isMarkdown = content?.type && content.type === 'text/markdown';

    // Get content processor type for file extension detection
    const contentProcessorType = getContentProcessorType(object);

    const handleExportDocument = async (format: MarkdownRenditionFormat, useDefaultTemplate?: boolean) => {
        // Prevent multiple concurrent exports
        if (isDownloading) return;

        // Show immediate feedback
        toast({
            status: 'info',
            title: `Preparing ${format.toUpperCase()}`,
            description: t('store.renderingDocument'),
            duration: 2000,
        });

        // For branded exports, use the project-configured template if available
        const templateObjectId = useDefaultTemplate !== false ? pdfTemplateObjectId : undefined;

        await renderDocument(object.id, {
            format,
            title: object.name || 'document',
            useDefaultTemplate,
            templateObjectId,
        });
    };

    const handleExportDocx = () => handleExportDocument(MarkdownRenditionFormat.docx);
    const handleExportPdf = () => handleExportDocument(MarkdownRenditionFormat.pdf, false);
    const handleExportBrandedPdf = () => handleExportDocument(MarkdownRenditionFormat.pdf);

    const handleDownloadText = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!fullText) return;
        // Determine file extension based on content processor type
        let ext = 'txt';
        let mimeType = 'text/plain';
        if (contentProcessorType === 'xml') {
            ext = 'xml';
            mimeType = 'text/xml';
        } else if (contentProcessorType === 'markdown' || isMarkdown) {
            ext = 'md';
            mimeType = 'text/markdown';
        }
        const blob = new Blob([fullText], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const filename = `${object.name || 'document'}.${ext}`;

        // Use the download attribute with an anchor, but avoid triggering navigation
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        // Temporarily remove from DOM event flow
        setTimeout(() => {
            link.click();
            URL.revokeObjectURL(url);
        }, 0);
    };

    return (
        <div className="h-[41px] text-lg font-semibold flex justify-between items-center px-2">
            <div className="flex items-center gap-2">
                {fullText && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            title="Copy text"
                            onClick={() => handleCopyContent(fullText, 'text')}
                        >
                            <Copy className="size-4" />
                        </Button>
                        {canEdit && onToggleEdit && (
                            <SecureButton
                                permission={Permission.content_write}
                                variant="ghost"
                                size="sm"
                                onClick={onToggleEdit}
                                title={t('store.editText')}
                                className="flex items-center gap-2"
                            >
                                <SquarePen className="size-4" />
                            </SecureButton>
                        )}
                    </>
                )}
                {isDownloading ? (
                    <Button variant="ghost" size="sm" disabled className="flex items-center gap-2" alt="download">
                        <Spinner size="sm" />
                    </Button>
                ) : (
                    <Dropdown
                        trigger={
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={!text}
                                className="flex items-center gap-2"
                                alt="download"
                            >
                                <Download className="size-4" />
                            </Button>
                        }
                    >
                        {fullText && (
                            <MenuItem onClick={handleDownloadText}>
                                <div className="flex items-center gap-2">
                                    <Download className="size-4" />
                                    Download Text
                                </div>
                            </MenuItem>
                        )}
                        {isMarkdown && text && (
                            <>
                                <MenuItem onClick={handleExportDocx}>
                                    <div className="flex items-center gap-2">
                                        <Download className="size-4" />
                                        Export as DOCX
                                    </div>
                                </MenuItem>
                                <MenuItem onClick={handleExportPdf}>
                                    <div className="flex items-center gap-2">
                                        <Download className="size-4" />
                                        Export as PDF
                                    </div>
                                </MenuItem>
                                <MenuItem onClick={handleExportBrandedPdf}>
                                    <div className="flex items-center gap-2">
                                        <Download className="size-4" />
                                        Export as Branded PDF
                                    </div>
                                </MenuItem>
                            </>
                        )}
                    </Dropdown>
                )}
            </div>
        </div>
    );
}

const TextPanel = memo(({ object, text, isTextCropped, textContainerRef }: TextPanelProps) => {
    const { t } = useUITranslation();
    const content = object.content;
    const isCreatedOrProcessing = isCreatedOrProcessingStatus(object?.status);

    // Check content processor type for XML
    const contentProcessorType = getContentProcessorType(object);
    const isXml = contentProcessorType === 'xml';

    // Check if content type is markdown or plain text
    const isMarkdownOrText = content?.type && (content.type === 'text/markdown' || content.type === 'text/plain');

    // Render as markdown if it's markdown/text type OR if text looks like markdown (but not if XML)
    const shouldRenderAsMarkdown = !isXml && (isMarkdownOrText || looksLikeMarkdown(text));

    return text ? (
        <>
            {isTextCropped && (
                <div className="px-2 py-2 bg-attention/10 border-s-4 border-attention mx-2 mb-2 rounded">
                    <div className="flex items-center gap-2 text-attention">
                        <AlertTriangle className="size-4" />
                        <span className="text-sm font-semibold">{t('store.showingFirst128K')}</span>
                    </div>
                </div>
            )}
            <div className={`max-w-7xl px-2 h-full overflow-auto`} ref={textContainerRef}>
                {isXml ? (
                    <div className="px-4 py-2">
                        <XMLViewer xml={text} collapsible />
                    </div>
                ) : shouldRenderAsMarkdown ? (
                    <div className="vprose prose-sm p-1">
                        <MarkdownRenderer components={createMarkdownComponents()}>{text}</MarkdownRenderer>
                    </div>
                ) : (
                    <pre className="text-wrap bg-muted text-muted p-2">{text}</pre>
                )}
            </div>
        </>
    ) : (
        <div className="px-2">
            <div>{isCreatedOrProcessing ? 'Extracting content...' : 'No content'}</div>
        </div>
    );
});

function TranscriptPanel({
    object,
    handleCopyContent,
}: {
    object: ContentObject;
    handleCopyContent: (content: string, type: 'text' | 'properties') => Promise<void>;
}) {
    const { t } = useUITranslation();
    const transcript = object.transcript;
    const transcriptText = transcript?.text;
    const segments = transcript?.segments;

    // Build full text from segments if text is not available
    const fullText = transcriptText || (segments ? segments.map((s) => s.text).join(' ') : '');

    const formatTimestamp = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-end items-center px-2 mb-2">
                {fullText && (
                    <Button
                        variant="ghost"
                        size="sm"
                        title="Copy transcript"
                        onClick={() => handleCopyContent(fullText, 'text')}
                    >
                        <Copy className="size-4" />
                    </Button>
                )}
            </div>
            <div className={`h-full} overflow-auto px-2`}>
                {segments && segments.length > 0 ? (
                    <div className="space-y-2">
                        {segments.map((segment, idx) => (
                            <div key={`segment-${idx}`} className="flex gap-3 text-sm">
                                <span className="text-muted font-mono text-xs shrink-0 pt-0.5">
                                    {formatTimestamp(segment.start)}
                                    {segment.end && ` - ${formatTimestamp(segment.end)}`}
                                </span>
                                <span className="flex-1">{segment.text}</span>
                            </div>
                        ))}
                    </div>
                ) : transcriptText ? (
                    <pre className="text-wrap bg-muted text-muted p-2 whitespace-pre-wrap">{transcriptText}</pre>
                ) : (
                    <div className="text-muted">{t('store.noTranscriptAvailable')}</div>
                )}
            </div>
        </div>
    );
}

function PdfActions({ object }: { object: ContentObject }) {
    const [isPdfPreviewOpen, setPdfPreviewOpen] = useState(false);

    // Check if PDF has been processed (content_processor.type is xml or markdown)
    const contentProcessorType = getContentProcessorType(object);
    const hasPdfAnalysis = contentProcessorType === 'xml' || contentProcessorType === 'markdown';

    if (!hasPdfAnalysis) return null;

    return (
        <>
            <Button variant="ghost" size="sm" onClick={() => setPdfPreviewOpen(true)} title="Side by side view">
                <FileSearch className="size-4" />
            </Button>
            {isPdfPreviewOpen && (
                <Portal>
                    <MagicPdfView objectId={object.id} onClose={() => setPdfPreviewOpen(false)} />
                </Portal>
            )}
        </>
    );
}

function OfficePdfActions({ object, pdfRendition, officePdfUrl }: OfficePdfActionsProps) {
    const { client } = useUserSession();
    const toast = useToast();
    const { t } = useUITranslation();
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        try {
            let downloadUrl = officePdfUrl;

            // If we have a rendition source but no signed URL yet, get a signed URL
            if (!downloadUrl && pdfRendition?.content?.source) {
                const response = await client.files.getDownloadUrl(
                    pdfRendition.content.source,
                    `${object.name || 'document'}.pdf`,
                    'attachment',
                );
                downloadUrl = response.url;
            }

            if (downloadUrl) {
                // Open in new tab - browser will handle as download due to content-disposition
                window.open(downloadUrl, '_blank');
            }
        } catch (err) {
            console.error('Failed to download PDF:', err);
            toast({
                status: 'error',
                title: t('store.downloadFailed'),
                description: t('store.failedToDownloadPdf'),
                duration: 5000,
            });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDownloadPdf} disabled={isDownloading} title="Download PDF">
                {isDownloading ? <Spinner size="sm" /> : <Download className="size-4" />}
            </Button>
        </div>
    );
}

function PdfPreviewPanel({ object }: { object: ContentObject }) {
    return (
        <div className="h-full">
            <SimplePdfViewer object={object} className="h-full" />
        </div>
    );
}

/**
 * Panel for displaying Office documents converted to PDF.
 * Handles the various states: converting, error, showing PDF.
 */
function OfficePdfPreviewPanel({
    pdfRendition,
    officePdfUrl,
    officePdfConverting,
    officePdfError,
    onConvert,
}: OfficePdfPreviewPanelProps) {
    const { t } = useUITranslation();
    if (officePdfConverting) {
        return (
            <div className="flex flex-col justify-center items-center flex-1 gap-2">
                <Spinner size="lg" />
                <span className="text-muted">{t('store.convertingToPdf')}</span>
            </div>
        );
    }

    if (officePdfError) {
        return (
            <div className="flex flex-col justify-center items-center flex-1 gap-2 text-destructive">
                <AlertTriangle className="size-8" />
                <span>{officePdfError}</span>
            </div>
        );
    }

    if (pdfRendition?.content?.source) {
        return (
            <div className="h-full">
                <SimplePdfViewer source={pdfRendition.content.source} className="h-full" />
            </div>
        );
    }

    if (officePdfUrl) {
        return (
            <div className="h-full">
                <SimplePdfViewer url={officePdfUrl} className="h-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col justify-center items-center flex-1 gap-2">
            <Button onClick={onConvert}>Convert to PDF</Button>
        </div>
    );
}

function PdfProcessingPanel({
    progress,
    status,
    outputFormat,
}: {
    progress?: DocAnalyzerProgress;
    status?: WorkflowExecutionStatus;
    outputFormat?: DocProcessorOutputFormat;
}) {
    const { t } = useUITranslation();
    const statusColor = getWorkflowStatusColor(status);
    const statusName = getWorkflowStatusName(status);

    // Show detailed progress (tables, images, visuals) for XML processing
    const isXmlProcessing = outputFormat === 'xml';

    // Ensure percent is a valid number (handle undefined and NaN from division by zero)
    const percent = progress?.percent != null && !Number.isNaN(progress.percent) ? progress.percent : 0;

    return (
        <div className="px-4 py-4">
            {progress && (
                <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                        <ProgressLine
                            name={isXmlProcessing ? 'Analyze Layouts' : 'Analyze Page'}
                            progress={progress.pages}
                        />
                        {isXmlProcessing && (
                            <>
                                <ProgressLine name="Extract Tables" progress={progress.tables} />
                                <ProgressLine name="Describe Images" progress={progress.images} />
                                <ProgressLine name="Process Visually" progress={progress.visuals} />
                            </>
                        )}
                    </div>
                    <div className="pt-2 text-sm text-muted">
                        Progress: {percent}%<span className="px-2">&bull;</span>
                        <span className={statusColor}>{statusName}</span>
                        {progress.started_at && (
                            <>
                                <span className="px-2">&bull;</span>
                                <span>{((Date.now() - progress.started_at) / 1000).toFixed(0)} sec. elapsed</span>
                            </>
                        )}
                    </div>
                    <Progress percent={percent} />
                </div>
            )}
            {!progress && (
                <div className="flex items-center gap-2 text-muted">
                    <Spinner size="sm" />
                    <span>{t('store.loadingProcessingStatus')}</span>
                </div>
            )}
        </div>
    );
}

function ProgressLine({ name, progress }: { name: string; progress: { total: number; processed: number } }) {
    return (
        <div className="flex gap-2 text-sm">
            <span className="text-muted min-w-36">{name}:</span>
            <span>
                {progress.processed} of {progress.total}
            </span>
        </div>
    );
}
