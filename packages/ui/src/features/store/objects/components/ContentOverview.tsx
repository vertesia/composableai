import { useEffect, useState, memo, useRef, type RefObject } from "react";

import { useUserSession } from "@vertesia/ui/session";
import { Button, Portal, ResizableHandle, ResizablePanel, ResizablePanelGroup, Spinner, useToast, Modal, ModalBody, ModalFooter, ModalTitle } from "@vertesia/ui/core";
import { JSONDisplay, MarkdownRenderer, Progress, XMLViewer } from "@vertesia/ui/widgets";
import { ContentNature, ContentObject, ContentObjectStatus, DocAnalyzerProgress, DocProcessorOutputFormat, DocumentMetadata, ImageRenditionFormat, VideoMetadata, POSTER_RENDITION_NAME, WorkflowExecutionStatus, PDF_RENDITION_NAME } from "@vertesia/common";
import { Copy, Download, SquarePen, AlertTriangle, FileSearch } from "lucide-react";
import { isPreviewableAsPdf, printElementToPdf, getWorkflowStatusColor, getWorkflowStatusName } from "../../../utils/index.js";
import { PropertiesEditorModal } from "./PropertiesEditorModal";
import { NavLink } from "@vertesia/ui/router";
import { MagicPdfView } from "../../../magic-pdf";
import { SimplePdfViewer } from "../../../pdf-viewer";
import { useObjectText, usePdfProcessingStatus, useOfficePdfConversion } from "./useContentPanelHooks.js";

// Web-supported image formats for browser display
const WEB_SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

// Web-supported video formats for browser display
const WEB_SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/webm'];

// Panel height constants for consistent layout
const PANEL_HEIGHTS = {
    /** Main resizable panel group */
    main: "h-[calc(100vh-208px)]",
    /** Properties panel content area */
    properties: "h-[calc(100vh-228px)]",
    /** Text/PDF content panel */
    content: "h-[calc(100vh-218px)]",
    /** Video max height */
    video: "max-h-[calc(100vh-268px)]",
} as const;

// ----- Type Definitions -----

interface TextActionsProps {
    object: ContentObject;
    text: string | undefined;
    fullText: string | undefined;
    handleCopyContent: (content: string, type: "text" | "properties") => Promise<void>;
    textContainerRef: RefObject<HTMLDivElement | null>;
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
        const href = props.href || "";
        if (href.includes("/store/objects/")) {
            return (
                <NavLink topLevelNav href={href} className="text-info">
                    {props.children}
                </NavLink>
            );
        }
        return <a {...props} target="_blank" rel="noopener noreferrer" />;
    },
    p: ({ node, ...props }: MarkdownComponentProps) => (
        <p {...props} className="my-0" />
    ),
    pre: ({ node, ...props }: MarkdownComponentProps) => (
        <pre {...props} className="my-2 p-2 rounded" />
    ),
    code: ({ node, className, children, ...props }: MarkdownComponentProps & { className?: string }) => {
        const match = /language-(\w+)/.exec(className || "");
        const isInline = !match;
        return (
            <code
                {...props}
                className={isInline ? "px-1.5 py-0.5 rounded" : "text-muted"}
            >
                {children}
            </code>
        );
    },
    h1: ({ node, ...props }: MarkdownComponentProps) => (
        <h1 {...props} className="font-bold text-2xl my-2" />
    ),
    h2: ({ node, ...props }: MarkdownComponentProps) => (
        <h2 {...props} className="font-bold text-xl my-2" />
    ),
    h3: ({ node, ...props }: MarkdownComponentProps) => (
        <h3 {...props} className="font-bold text-lg my-2" />
    ),
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
        text.includes("\n# ") ||
        text.includes("\n## ") ||
        text.includes("\n### ") ||
        text.includes("\n* ") ||
        text.includes("\n- ") ||
        text.includes("\n+ ") ||
        text.includes("![") ||
        text.includes("](")
    );
}

enum PanelView {
    Text = "text",
    Image = "image",
    Video = "video",
    Pdf = "pdf"
}

interface ContentOverviewProps {
    object: ContentObject;
    loadText?: boolean;
    refetch?: () => Promise<unknown>;
}
export function ContentOverview({
    object,
    loadText,
    refetch,
}: ContentOverviewProps) {
    const toast = useToast();

    const handleCopyContent = async (
        content: string,
        type: "text" | "properties",
    ) => {
        try {
            await navigator.clipboard.writeText(content);
            toast({
                status: "success",
                title: `${type === "text" ? "Content" : "Properties"} copied`,
                description: `Successfully copied ${type} to clipboard`,
                duration: 2000,
            });
        } catch (err) {
            console.error(`Failed to copy ${type}:`, err);
            toast({
                status: "error",
                title: "Copy failed",
                description: `Failed to copy ${type} to clipboard`,
                duration: 5000,
            });
        }
    };

    return (
        <>
            <ResizablePanelGroup direction="horizontal" className={PANEL_HEIGHTS.main}>
                <ResizablePanel className="min-w-[100px]">
                    <PropertiesPanel object={object} refetch={refetch ?? (() => Promise.resolve())} handleCopyContent={handleCopyContent} />
                </ResizablePanel>
                <ResizableHandle withHandle />

                <ResizablePanel className="min-w-[100px]">
                    <DataPanel object={object} loadText={loadText ?? false} handleCopyContent={handleCopyContent} refetch={refetch} />
                </ResizablePanel>
            </ResizablePanelGroup>

        </>
    );
}

function PropertiesPanel({ object, refetch, handleCopyContent }: { object: ContentObject, refetch: () => Promise<unknown>, handleCopyContent: (content: string, type: "text" | "properties") => Promise<void> }) {
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
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-1 bg-muted mb-2 p-1 rounded">
                    <Button
                        variant={`${viewCode ? "ghost" : "primary"}`}
                        size="sm"
                        alt="Preview properties"
                        onClick={() => setViewCode(!viewCode)}
                    >
                        Properties
                    </Button>
                    <Button
                        variant={`${viewCode ? "primary" : "ghost"}`}
                        size="sm"
                        alt="View in JSON format"
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
                                handleCopyContent(
                                    JSON.stringify(
                                        object.properties,
                                        null,
                                        2,
                                    ),
                                    "properties",
                                )
                            }
                        >
                            <Copy className="size-4" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenPropertiesModal}
                        title="Edit properties"
                        className="flex items-center gap-2"
                    >
                        <SquarePen className="size-4" />
                    </Button>
                </div>
            </div>

            {
                object.properties ? (
                    <div className={`${PANEL_HEIGHTS.properties} overflow-auto px-2`}>
                        <JSONDisplay
                            value={object.properties}
                            viewCode={viewCode}

                        />
                    </div>
                ) : (
                    <div className={`${PANEL_HEIGHTS.properties} overflow-auto px-2`}>
                        <div>No properties defined</div>
                    </div>
                )
            }
            {/* Properties Editor Modal */}
            <PropertiesEditorModal
                isOpen={isPropertiesModalOpen}
                onClose={handleClosePropertiesModal}
                object={object}
                refetch={refetch}
            />
        </>
    );
}

function DataPanel({ object, loadText, handleCopyContent, refetch }: { object: ContentObject, loadText: boolean, handleCopyContent: (content: string, type: "text" | "properties") => Promise<void>, refetch?: () => Promise<unknown> }) {
    const isImage = object?.metadata?.type === ContentNature.Image;
    const isVideo = object?.metadata?.type === ContentNature.Video;
    const isPdf = object?.content?.type === 'application/pdf';
    const isPreviewableAsPdfDoc = object?.content?.type ? isPreviewableAsPdf(object.content.type) : false;
    const isCreatedOrProcessing = isCreatedOrProcessingStatus(object?.status);

    // Check if PDF rendition exists for Office documents
    const metadata = object.metadata as DocumentMetadata;
    const pdfRendition = metadata?.renditions?.find(r => r.name === PDF_RENDITION_NAME);

    // Determine initial panel view
    const getInitialView = (): PanelView => {
        if (isVideo) return PanelView.Video;
        if (isImage) return PanelView.Image;
        return PanelView.Text;
    };

    const [currentPanel, setCurrentPanel] = useState<PanelView>(getInitialView());

    // Use custom hooks for text loading, PDF processing, and Office conversion
    const {
        fullText,
        displayText,
        isLoading: isLoadingText,
        isCropped: isTextCropped,
    } = useObjectText(object.id, object.text, loadText);

    // Poll for PDF/document processing status when object is created or processing
    const shouldPollProgress = (isPdf || isPreviewableAsPdfDoc) && isCreatedOrProcessing;
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

    // Reload object when PDF processing completes
    useEffect(() => {
        if (processingComplete && pdfStatus === WorkflowExecutionStatus.COMPLETED) {
            refetch?.();
        }
    }, [processingComplete, pdfStatus, refetch]);

    // Show processing panel when workflow is running (for both PDFs and Office documents)
    const showProcessingPanel = (isPdf || isPreviewableAsPdfDoc) && isCreatedOrProcessing && !processingComplete && pdfStatus === WorkflowExecutionStatus.RUNNING;

    const textContainerRef = useRef<HTMLDivElement | null>(null);

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center px-2 shrink-0">
                <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1 bg-muted p-1 rounded">
                        {isImage &&
                            <Button
                                variant={currentPanel === PanelView.Image ? "primary" : "ghost"}
                                size="sm"
                                alt="View Image"
                                onClick={() => setCurrentPanel(PanelView.Image)}
                            >
                                Image
                            </Button>
                        }
                        {isVideo &&
                            <Button
                                variant={currentPanel === PanelView.Video ? "primary" : "ghost"}
                                size="sm"
                                alt="View Video"
                                onClick={() => setCurrentPanel(PanelView.Video)}
                            >
                                Video
                            </Button>
                        }
                        <Button
                            variant={currentPanel === PanelView.Text ? "primary" : "ghost"}
                            size="sm"
                            alt="View Text"
                            onClick={() => setCurrentPanel(PanelView.Text)}
                        >
                            Text
                        </Button>
                        {isPdf &&
                            <Button
                                variant={currentPanel === PanelView.Pdf ? "primary" : "ghost"}
                                size="sm"
                                alt="View PDF"
                                onClick={() => setCurrentPanel(PanelView.Pdf)}
                            >
                                PDF
                            </Button>
                        }
                        {isPreviewableAsPdfDoc && (
                            <Button
                                variant={currentPanel === PanelView.Pdf ? "primary" : "ghost"}
                                size="sm"
                                alt="View as PDF"
                                onClick={() => {
                                    setCurrentPanel(PanelView.Pdf);
                                    if (!pdfRendition && !officePdfUrl && !officePdfConverting) {
                                        triggerOfficePdfConversion();
                                    }
                                }}
                                disabled={officePdfConverting}
                            >
                                {officePdfConverting ? <Spinner size="sm" /> : "PDF"}
                            </Button>
                        )}
                    </div>
                    <PdfActions object={object} />
                </div>
                {currentPanel === PanelView.Text && !showProcessingPanel && (
                    <TextActions
                        object={object}
                        text={displayText}
                        fullText={fullText}
                        handleCopyContent={handleCopyContent}
                        textContainerRef={textContainerRef}
                    />
                )}
                {currentPanel === PanelView.Pdf && isPreviewableAsPdfDoc && (pdfRendition || officePdfUrl) && (
                    <OfficePdfActions
                        object={object}
                        pdfRendition={pdfRendition}
                        officePdfUrl={officePdfUrl}
                    />
                )}
            </div>
            {currentPanel === PanelView.Image && (
                <ImagePanel object={object} />
            )}
            {currentPanel === PanelView.Video && (
                <VideoPanel object={object} />
            )}
            {currentPanel === PanelView.Pdf && isPdf && (
                <PdfPreviewPanel object={object} />
            )}
            {currentPanel === PanelView.Pdf && isPreviewableAsPdfDoc && (
                <OfficePdfPreviewPanel
                    pdfRendition={pdfRendition}
                    officePdfUrl={officePdfUrl}
                    officePdfConverting={officePdfConverting}
                    officePdfError={officePdfError}
                    onConvert={triggerOfficePdfConversion}
                />
            )}
            {currentPanel === PanelView.Text && showProcessingPanel && (
                <PdfProcessingPanel progress={pdfProgress} status={pdfStatus} outputFormat={pdfOutputFormat} />
            )}
            {currentPanel === PanelView.Text && !showProcessingPanel && isLoadingText && (
                <div className="flex justify-center items-center flex-1">
                    <Spinner size="lg" />
                </div>
            )}
            {currentPanel === PanelView.Text && !showProcessingPanel && !isLoadingText && (
                <TextPanel
                    object={object}
                    text={displayText}
                    isTextCropped={isTextCropped}
                    textContainerRef={textContainerRef}
                />
            )}
        </div>
    );
}

function TextActions({
    object,
    text,
    fullText,
    handleCopyContent,
    textContainerRef,
}: TextActionsProps) {
    const { client } = useUserSession();
    const toast = useToast();
    const [loadingFormat, setLoadingFormat] = useState<"docx" | "pdf" | null>(null);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    const content = object.content;

    const isMarkdown =
        content &&
        content.type &&
        content.type === "text/markdown";

    // Get content processor type for file extension detection
    const contentProcessorType = getContentProcessorType(object);

    const handleExportDocument = async (format: "docx" | "pdf") => {
        // Prevent multiple concurrent exports
        if (loadingFormat) return;

        setLoadingFormat(format);

        // Show immediate feedback
        toast({
            status: "info",
            title: `Preparing ${format.toUpperCase()}`,
            description: "Fetching your document...",
            duration: 2000,
        });

        try {
            // Request document rendition from the server
            const response = await client.objects.getRendition(object.id, {
                format: format as any, // We're extending the format type
                generate_if_missing: true,
                sign_url: true,
            });

            if (response.status === "generating") {
                toast({
                    status: "info",
                    title: "Generating document",
                    description: `Please wait while we prepare your ${format.toUpperCase()} file...`,
                    duration: 5000,
                });

                // Poll for completion
                setTimeout(() => handleExportDocument(format), 3000);
                return;
            }

            if (response.status === "failed") {
                throw new Error("Document generation failed");
            }

            // Download the generated file or open in new window
            if (response.renditions && response.renditions.length > 0) {
                const downloadUrl = response.renditions[0];

                if (format === 'pdf') {
                    // Open PDF in new window
                    window.open(downloadUrl, '_blank');
                    toast({
                        status: "success",
                        title: "PDF opened",
                        description: "PDF document opened in a new window",
                        duration: 2000,
                    });
                } else {
                    // Download DOCX file
                    const link = document.createElement("a");
                    link.href = downloadUrl;
                    link.download = `${object.name || "document"}.${format}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    toast({
                        status: "success",
                        title: "Document exported",
                        description: `Successfully exported to ${format.toUpperCase()} format`,
                        duration: 2000,
                    });
                }
            }
        } catch (err) {
            console.error(`Failed to export document as ${format}:`, err);
            toast({
                status: "error",
                title: "Export failed",
                description: `Failed to export document to ${format.toUpperCase()} format`,
                duration: 5000,
            });
        } finally {
            setLoadingFormat(null);
        }
    };

    const handleExportDocx = () => handleExportDocument("docx");

    const handleClientPdfExport = () => {
        if (!textContainerRef.current) {
            toast({
                status: "error",
                title: "PDF export failed",
                description: "No content available to export",
                duration: 3000,
            });
            return;
        }
        setIsPdfModalOpen(true);
    };

    const handleConfirmClientPdfExport = () => {
        if (!textContainerRef.current) {
            toast({
                status: "error",
                title: "PDF export failed",
                description: "No content available to export",
                duration: 3000,
            });
            return;
        }

        const baseName = object.name || object.id;
        const pdfTitle = `${baseName || "document"} - content`;
        const success = printElementToPdf(textContainerRef.current, pdfTitle);

        if (!success) {
            toast({
                status: "error",
                title: "PDF export failed",
                description: "Unable to open print preview",
                duration: 4000,
            });
            return;
        }

        toast({
            status: "success",
            title: "PDF export ready",
            description: "Use your browser's Print dialog to save as PDF",
            duration: 4000,
        });
        setIsPdfModalOpen(false);
    };

    const handleDownloadText = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!fullText) return;
        // Determine file extension based on content processor type
        let ext = "txt";
        let mimeType = "text/plain";
        if (contentProcessorType === "xml") {
            ext = "xml";
            mimeType = "text/xml";
        } else if (contentProcessorType === "markdown" || isMarkdown) {
            ext = "md";
            mimeType = "text/markdown";
        }
        const blob = new Blob([fullText], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const filename = `${object.name || "document"}.${ext}`;

        // Use the download attribute with an anchor, but avoid triggering navigation
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        // Temporarily remove from DOM event flow
        setTimeout(() => {
            link.click();
            URL.revokeObjectURL(url);
        }, 0);
    };

    return (
        <>
            <div className="h-[41px] text-lg font-semibold flex justify-between items-center px-2">
                <div className="flex items-center gap-2">
                    {fullText && (
                        <>
                            <Button variant="ghost" size="sm" title="Copy text" onClick={() => handleCopyContent(fullText, "text")}>
                                <Copy className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Download text" onClick={handleDownloadText}>
                                <Download className="size-4" />
                            </Button>
                        </>
                    )}
                    {isMarkdown && text && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleExportDocx}
                                disabled={loadingFormat !== null}
                                className="flex items-center gap-2"
                            >
                                {loadingFormat === "docx" ? (
                                    <Spinner size="sm" />
                                ) : (
                                    <Download className="size-4" />
                                )}
                                DOCX
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClientPdfExport}
                                className="flex items-center gap-2"
                            >
                                <Download className="size-4" />
                                PDF
                            </Button>
                        </>
                    )}
                </div>
            </div>
            <Modal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)}>
                <ModalTitle>Export document as PDF</ModalTitle>
                <ModalBody>
                    <p className="mb-2">
                        This will open your browser&apos;s print dialog with the current document content.
                    </p>
                    <p className="text-sm text-muted">
                        To save a PDF, choose &quot;Save as PDF&quot; or a similar option in the print dialog.
                    </p>
                </ModalBody>
                <ModalFooter align="right">
                    <Button variant="ghost" size="sm" onClick={() => setIsPdfModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleConfirmClientPdfExport}>
                        Open print dialog
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
}

const TextPanel = memo(({
    object,
    text,
    isTextCropped,
    textContainerRef,
}: TextPanelProps) => {
    const content = object.content;
    const isCreatedOrProcessing = isCreatedOrProcessingStatus(object?.status);

    // Check content processor type for XML
    const contentProcessorType = getContentProcessorType(object);
    const isXml = contentProcessorType === "xml";

    // Check if content type is markdown or plain text
    const isMarkdownOrText =
        content &&
        content.type &&
        (content.type === "text/markdown" || content.type === "text/plain");

    // Render as markdown if it's markdown/text type OR if text looks like markdown (but not if XML)
    const shouldRenderAsMarkdown = !isXml && (isMarkdownOrText || looksLikeMarkdown(text));

    return (
        text ? (
            <>
                {isTextCropped && (
                    <div className="px-2 py-2 bg-attention/10 border-l-4 border-attention mx-2 mb-2 rounded">
                        <div className="flex items-center gap-2 text-attention">
                            <AlertTriangle className="size-4" />
                            <span className="text-sm font-semibold">Showing first 128K characters only</span>
                        </div>
                    </div>
                )}
                <div
                    className={`max-w-7xl px-2 ${PANEL_HEIGHTS.content} overflow-auto`}
                    ref={textContainerRef}
                >
                    {isXml ? (
                        <div className="px-4 py-2">
                            <XMLViewer xml={text} collapsible />
                        </div>
                    ) : shouldRenderAsMarkdown ? (
                        <div className="vprose prose-sm p-1">
                            <MarkdownRenderer components={createMarkdownComponents()}>
                                {text}
                            </MarkdownRenderer>
                        </div>
                    ) : (
                        <pre className="text-wrap bg-muted text-muted p-2">
                            {text}
                        </pre>
                    )}
                </div>
            </>
        ) :
            <div className="px-2">
                <div>{isCreatedOrProcessing ? "Extracting content..." : "No content"}</div>
            </div>
    );
});

function ImagePanel({ object }: { object: ContentObject }) {
    const { client } = useUserSession();
    const [imageUrl, setImageUrl] = useState<string>();

    const content = object.content;
    const isImage = object.metadata && object.metadata.type === ContentNature.Image;

    useEffect(() => {
        if (isImage) {
            const loadImage = async () => {
                const isOriginalWebSupported = content?.type && WEB_SUPPORTED_IMAGE_FORMATS.includes(content.type);

                try {
                    const rendition = await client.objects.getRendition(object.id, {
                        format: ImageRenditionFormat.jpeg,
                        generate_if_missing: false,
                        sign_url: true,
                    });

                    if (rendition.status === "found" && rendition.renditions?.length) {
                        // Use rendition URL directly
                        setImageUrl(rendition.renditions[0]);
                    } else if (isOriginalWebSupported) {
                        // Fall back to original file only if web-supported
                        const downloadUrl = await client.files.getDownloadUrl(object.content.source!);
                        setImageUrl(downloadUrl.url);
                    }
                } catch (error) {
                    // Fall back to original file only if web-supported
                    if (isOriginalWebSupported) {
                        const downloadUrl = await client.files.getDownloadUrl(object.content.source!);
                        setImageUrl(downloadUrl.url);
                    }
                }
            };

            loadImage();
        }
    }, []);

    return (
        <div className="mb-4 px-2">
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={object.name}
                    className="w-full object-contain"
                />
            ) : (
                <Spinner size="md" />
            )}
        </div>
    );
}

function VideoPanel({ object }: { object: ContentObject }) {
    const { client } = useUserSession();
    const [videoUrl, setVideoUrl] = useState<string>();
    const [posterUrl, setPosterUrl] = useState<string>();
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const content = object.content;
    const isVideo = object.metadata?.type === ContentNature.Video;

    // Check if there are mp4 or webm renditions available in metadata
    const metadata = object.metadata as VideoMetadata;
    const renditions = metadata?.renditions || [];

    // Find mp4 or webm rendition by mime type, preferring mp4
    const webRendition = renditions.find(r => r.content.type === 'video/mp4') ||
                         renditions.find(r => r.content.type === 'video/webm');

    // Check if original file is web-compatible
    const isOriginalWebSupported = content?.type && WEB_SUPPORTED_VIDEO_FORMATS.includes(content.type);

    // Get poster
    const poster = renditions.find(r => r.name === POSTER_RENDITION_NAME);

    useEffect(() => {
        const loadPoster = async () => {
            if (poster?.content?.source) {
                try {
                    const response = await client.files.getDownloadUrl(poster.content.source);
                    setPosterUrl(response.url);
                } catch (error) {
                    console.error("Failed to load poster image", error);
                }
            }
        };
        loadPoster();
    }, [poster, client]);

    useEffect(() => {
        if (isVideo && (webRendition?.content?.source || isOriginalWebSupported)) {
            const loadVideoUrl = async () => {
                try {
                    let downloadUrl;
                    if (webRendition?.content?.source) {
                        // Use rendition if available
                        downloadUrl = await client.files.getDownloadUrl(webRendition.content.source);
                    } else if (isOriginalWebSupported && content?.source) {
                        // Fall back to original file if web-supported
                        downloadUrl = await client.files.getDownloadUrl(content.source);
                    }
                    if (downloadUrl) {
                        setVideoUrl(downloadUrl.url);
                    }
                } catch (error) {
                    console.error("Failed to get video URL", error);
                } finally {
                    setIsLoading(false);
                }
            };
            loadVideoUrl();
        } else {
            setIsLoading(false);
        }
    }, [isVideo, webRendition, isOriginalWebSupported, content?.source, client]);

    return (
        <div className="mb-4 px-2">
            {!webRendition && !isOriginalWebSupported ? (
                <div className="flex justify-center items-center h-[400px] text-muted">
                    <div className="text-center">
                        <p>No web-compatible video rendition available</p>
                        <p className="text-sm mt-2">MP4 or WebM format required</p>
                    </div>
                </div>
            ) : isLoading ? (
                <div className="flex justify-center items-center h-[400px]">
                    <Spinner size="md" />
                </div>
            ) : videoUrl ? (
                <video
                    src={videoUrl}
                    poster={posterUrl}
                    controls
                    className={`w-full ${PANEL_HEIGHTS.video} object-contain`}
                >
                    Your browser does not support the video tag.
                </video>
            ) : (
                <div className="flex justify-center items-center h-[400px] text-muted">
                    Failed to load video
                </div>
            )}
        </div>
    );
}

function PdfActions({ object }: { object: ContentObject }) {
    const [isPdfPreviewOpen, setPdfPreviewOpen] = useState(false);

    // Check if PDF has been processed (content_processor.type is xml or markdown)
    const contentProcessorType = getContentProcessorType(object);
    const hasPdfAnalysis = contentProcessorType === "xml" || contentProcessorType === "markdown";

    if (!hasPdfAnalysis) return null;

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setPdfPreviewOpen(true)}
                title="Side by side view"
            >
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

function OfficePdfActions({
    object,
    pdfRendition,
    officePdfUrl,
}: OfficePdfActionsProps) {
    const { client } = useUserSession();
    const toast = useToast();
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
                    'attachment'
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
                title: 'Download failed',
                description: 'Failed to download the PDF file',
                duration: 5000,
            });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                title="Download PDF"
            >
                {isDownloading ? <Spinner size="sm" /> : <Download className="size-4" />}
            </Button>
        </div>
    );
}

function PdfPreviewPanel({ object }: { object: ContentObject }) {
    return (
        <div className={PANEL_HEIGHTS.content}>
            <SimplePdfViewer
                object={object}
                className="h-full"
            />
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
    if (officePdfConverting) {
        return (
            <div className="flex flex-col justify-center items-center flex-1 gap-2">
                <Spinner size="lg" />
                <span className="text-muted">Converting to PDF...</span>
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
            <div className={PANEL_HEIGHTS.content}>
                <SimplePdfViewer source={pdfRendition.content.source} className="h-full" />
            </div>
        );
    }

    if (officePdfUrl) {
        return (
            <div className={PANEL_HEIGHTS.content}>
                <SimplePdfViewer url={officePdfUrl} className="h-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col justify-center items-center flex-1 gap-2">
            <Button onClick={onConvert}>
                Convert to PDF
            </Button>
        </div>
    );
}

function PdfProcessingPanel({ progress, status, outputFormat }: { progress?: DocAnalyzerProgress, status?: WorkflowExecutionStatus, outputFormat?: DocProcessorOutputFormat }) {
    const statusColor = getWorkflowStatusColor(status);
    const statusName = getWorkflowStatusName(status);

    // Show detailed progress (tables, images, visuals) for XML processing
    const isXmlProcessing = outputFormat === "xml";

    // Ensure percent is a valid number (handle undefined and NaN from division by zero)
    const percent = progress?.percent != null && !isNaN(progress.percent) ? progress.percent : 0;

    return (
        <div className="px-4 py-4">
            {progress && (
                <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                        <ProgressLine name={isXmlProcessing ? "Analyze Layouts" : "Analyze Page"} progress={progress.pages} />
                        {isXmlProcessing && (
                            <>
                                <ProgressLine name="Extract Tables" progress={progress.tables} />
                                <ProgressLine name="Describe Images" progress={progress.images} />
                                <ProgressLine name="Process Visually" progress={progress.visuals} />
                            </>
                        )}
                    </div>
                    <div className="pt-2 text-sm text-muted">
                        Progress: {percent}%
                        <span className="px-2">&bull;</span>
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
                    <span>Loading processing status...</span>
                </div>
            )}
        </div>
    );
}

function ProgressLine({ name, progress }: { name: string, progress: { total: number; processed: number } }) {
    return (
        <div className="flex gap-2 text-sm">
            <span className="text-muted min-w-36">{name}:</span>
            <span>{progress.processed} of {progress.total}</span>
        </div>
    );
}