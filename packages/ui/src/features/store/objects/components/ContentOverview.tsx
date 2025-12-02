import { useEffect, useState, memo, useRef, type RefObject } from "react";

import { useUserSession } from "@vertesia/ui/session";
import { Button, Portal, ResizableHandle, ResizablePanel, ResizablePanelGroup, Spinner, useToast, VModal, VModalBody, VModalFooter, VModalTitle } from "@vertesia/ui/core";
import { JSONDisplay, MarkdownRenderer, Progress, XMLViewer } from "@vertesia/ui/widgets";
import { ContentNature, ContentObject, ContentObjectStatus, DocAnalyzerProgress, DocumentMetadata, ImageRenditionFormat, VideoMetadata, POSTER_RENDITION_NAME, WorkflowExecutionStatus, PDF_RENDITION_NAME, MarkdownRenditionFormat } from "@vertesia/common";
import { Copy, Download, SquarePen, AlertTriangle, FileSearch } from "lucide-react";
import { isPreviewableAsPdf } from "../../../utils/mimeType.js";
import { PropertiesEditorModal } from "./PropertiesEditorModal";
import { NavLink } from "@vertesia/ui/router";
import { MagicPdfView } from "../../../magic-pdf";
import { SimplePdfViewer } from "../../../pdf-viewer";

// Maximum text size before cropping (128K characters)
const MAX_TEXT_DISPLAY_SIZE = 128 * 1024;

enum PanelView {
    Text = "text",
    Image = "image",
    Video = "video",
    Pdf = "pdf"
}

function printElementToPdf(sourceElement: HTMLElement, title: string): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return false;
    }

    // Use a hidden iframe to avoid opening a new window
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
        iframe.parentNode?.removeChild(iframe);
        return false;
    }

    const doc = iframeWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><title>${title}</title></head><body></body></html>`);
    doc.close();
    doc.title = title;

    const styles = document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>("link[rel=\"stylesheet\"], style");
    styles.forEach((node) => {
        doc.head.appendChild(node.cloneNode(true));
    });

    doc.body.innerHTML = sourceElement.innerHTML;
    iframeWindow.focus();
    iframeWindow.print();

    setTimeout(() => {
        iframe.parentNode?.removeChild(iframe);
    }, 1000);

    return true;
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
            <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-200px)]">
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
                    <div className="h-[calc(100vh-220px)] overflow-auto px-2">
                        <JSONDisplay
                            value={object.properties}
                            viewCode={viewCode}

                        />
                    </div>
                ) : (
                    <div className="h-[calc(100vh-220px)] overflow-auto px-2">
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
    const { store, client } = useUserSession();

    const isImage = object?.metadata?.type === ContentNature.Image;
    const isVideo = object?.metadata?.type === ContentNature.Video;
    const isPdf = object?.content?.type === 'application/pdf';
    const isPreviewableAsPdfDoc = object?.content?.type ? isPreviewableAsPdf(object.content.type) : false;
    const isCreatedOrProcessing = object?.status === ContentObjectStatus.created || object?.status === ContentObjectStatus.processing;

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

    // Store full text and cropped text separately
    const [fullText, setFullText] = useState<string | undefined>(object.text);
    const [displayText, setDisplayText] = useState<string | undefined>(() => {
        if (object.text && object.text.length > MAX_TEXT_DISPLAY_SIZE) {
            return object.text.substring(0, MAX_TEXT_DISPLAY_SIZE);
        }
        return object.text;
    });
    const [isLoadingText, setIsLoadingText] = useState<boolean>(false);
    const [isTextCropped, setIsTextCropped] = useState<boolean>(
        () => !!object.text && object.text.length > MAX_TEXT_DISPLAY_SIZE
    );

    // PDF processing state
    const [pdfProgress, setPdfProgress] = useState<DocAnalyzerProgress | undefined>();
    const [pdfStatus, setPdfStatus] = useState<WorkflowExecutionStatus | undefined>();
    const [processingComplete, setProcessingComplete] = useState(false);

    // Poll for PDF processing status when object is created or processing
    useEffect(() => {
        if (!isPdf || !isCreatedOrProcessing || processingComplete) return;

        let interrupted = false;
        function poll() {
            if (interrupted) return;
            client.objects.analyze(object.id).getStatus().then((r) => {
                setPdfProgress(r.progress);
                setPdfStatus(r.status);
                if (r.status === WorkflowExecutionStatus.RUNNING) {
                    // Workflow is running, poll every 2 seconds for progress
                    if (!interrupted) {
                        setTimeout(poll, 2000);
                    }
                } else {
                    // Workflow completed or terminal state
                    setProcessingComplete(true);
                }
            }).catch(() => {
                // No workflow found yet, poll every 10 seconds to check if one starts
                if (!interrupted) {
                    setTimeout(poll, 10000);
                }
            });
        }
        poll();
        return () => { interrupted = true; };
    }, [isPdf, isCreatedOrProcessing, processingComplete, object.id, client]);

    // Load text when requested or when processing completes
    const loadObjectText = () => {
        setIsLoadingText(true);
        store.objects
            .getObjectText(object.id)
            .then((res) => {
                setFullText(res.text);
                if (res.text.length > MAX_TEXT_DISPLAY_SIZE) {
                    setDisplayText(res.text.substring(0, MAX_TEXT_DISPLAY_SIZE));
                    setIsTextCropped(true);
                } else {
                    setDisplayText(res.text);
                    setIsTextCropped(false);
                }
            })
            .catch((err) => {
                console.error("Failed to load text", err);
            })
            .finally(() => {
                setIsLoadingText(false);
            });
    };

    useEffect(() => {
        if (loadText && !displayText) {
            loadObjectText();
        }
    }, [loadText]);

    // Reload object when PDF processing completes
    useEffect(() => {
        if (processingComplete && pdfStatus === WorkflowExecutionStatus.COMPLETED) {
            refetch?.();
        }
    }, [processingComplete, pdfStatus]);

    // Show PDF processing panel when workflow is running
    const showPdfProcessing = isPdf && isCreatedOrProcessing && !processingComplete && pdfStatus === WorkflowExecutionStatus.RUNNING;

    // Office document PDF conversion state
    // URL will be set by useEffect after resolving from source, or from getRendition response
    const [officePdfUrl, setOfficePdfUrl] = useState<string | undefined>();
    const [officePdfConverting, setOfficePdfConverting] = useState(false);
    const [officePdfError, setOfficePdfError] = useState<string | undefined>();

    // Trigger PDF conversion for Office documents
    const triggerOfficePdfConversion = async () => {
        if (!isPreviewableAsPdfDoc || officePdfConverting) return;

        setOfficePdfConverting(true);
        setOfficePdfError(undefined);

        const pollForPdf = async () => {
            try {
                const response = await client.objects.getRendition(object.id, {
                    format: MarkdownRenditionFormat.pdf,
                    generate_if_missing: true,
                    sign_url: true,
                });

                if (response.status === "generating") {
                    // Poll every 5 seconds
                    setTimeout(pollForPdf, 5000);
                } else if (response.status === "found" && response.renditions?.length) {
                    setOfficePdfUrl(response.renditions[0]);
                    setOfficePdfConverting(false);
                    // Refetch to update metadata with new rendition
                    refetch?.();
                } else if (response.status === "failed") {
                    setOfficePdfError("PDF conversion failed");
                    setOfficePdfConverting(false);
                }
            } catch (err) {
                console.error("Failed to convert Office document to PDF:", err);
                setOfficePdfError("Failed to convert to PDF");
                setOfficePdfConverting(false);
            }
        };

        await pollForPdf();
    };

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
                                    if (!officePdfUrl && !officePdfConverting) {
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
                {currentPanel === PanelView.Text && !showPdfProcessing && (
                    <TextActions
                        object={object}
                        text={displayText}
                        fullText={fullText}
                        handleCopyContent={handleCopyContent}
                        textContainerRef={textContainerRef}
                    />
                )}
            </div>
            {
                currentPanel === PanelView.Image ? (
                    <ImagePanel object={object} />
                ) : currentPanel === PanelView.Video ? (
                    <VideoPanel object={object} />
                ) : currentPanel === PanelView.Pdf ? (
                    isPdf ? (
                        <PdfPreviewPanel object={object} />
                    ) : isPreviewableAsPdfDoc ? (
                        officePdfConverting ? (
                            <div className="flex flex-col justify-center items-center flex-1 gap-2">
                                <Spinner size="lg" />
                                <span className="text-muted">Converting to PDF...</span>
                            </div>
                        ) : officePdfError ? (
                            <div className="flex flex-col justify-center items-center flex-1 gap-2 text-destructive">
                                <AlertTriangle className="size-8" />
                                <span>{officePdfError}</span>
                            </div>
                        ) : pdfRendition ? (
                            <div className="h-[calc(100vh-210px)]">
                                <SimplePdfViewer source={pdfRendition.content?.source} className="h-full" />
                            </div>
                        ) : officePdfUrl ? (
                            <div className="h-[calc(100vh-210px)]">
                                <SimplePdfViewer url={officePdfUrl} className="h-full" />
                            </div>
                        ) : (
                            <div className="flex flex-col justify-center items-center flex-1 gap-2">
                                <Button onClick={triggerOfficePdfConversion}>
                                    Convert to PDF
                                </Button>
                            </div>
                        )
                    ) : null
                ) : showPdfProcessing ? (
                    <PdfProcessingPanel progress={pdfProgress} status={pdfStatus} />
                ) : (
                    isLoadingText ? (
                        <div className="flex justify-center items-center flex-1">
                            <Spinner size="lg" />
                        </div>
                    ) : (
                        <TextPanel
                            object={object}
                            text={displayText}
                            isTextCropped={isTextCropped}
                            textContainerRef={textContainerRef}
                        />
                    )
                )
            }
        </div>
    );
}

function TextActions({
    object,
    text,
    fullText,
    handleCopyContent,
    textContainerRef,
}: {
    object: ContentObject;
    handleCopyContent: (content: string, type: "text" | "properties") => Promise<void>;
    text: string | undefined;
    fullText: string | undefined;
    textContainerRef: RefObject<HTMLDivElement | null>;
}) {
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
    const contentProcessorType = (object.metadata as DocumentMetadata)?.content_processor?.type;

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
            <VModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)}>
                <VModalTitle>Export document as PDF</VModalTitle>
                <VModalBody>
                    <p className="mb-2">
                        This will open your browser&apos;s print dialog with the current document content.
                    </p>
                    <p className="text-sm text-muted">
                        To save a PDF, choose &quot;Save as PDF&quot; or a similar option in the print dialog.
                    </p>
                </VModalBody>
                <VModalFooter align="right">
                    <Button variant="ghost" size="sm" onClick={() => setIsPdfModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleConfirmClientPdfExport}>
                        Open print dialog
                    </Button>
                </VModalFooter>
            </VModal>
        </>
    );
}

const TextPanel = memo(({
    object,
    text,
    isTextCropped,
    textContainerRef,
}: {
    object: ContentObject;
    text: string | undefined;
    isTextCropped: boolean;
    textContainerRef: RefObject<HTMLDivElement | null>;
}) => {
    const content = object.content;
    const isCreatedOrProcessing = object?.status === ContentObjectStatus.created || object?.status === ContentObjectStatus.processing;

    // Check content processor type for XML
    const contentProcessorType = (object.metadata as DocumentMetadata)?.content_processor?.type;
    const isXml = contentProcessorType === "xml";

    // Check if content type is markdown or plain text
    const isMarkdownOrText =
        content &&
        content.type &&
        (content.type === "text/markdown" || content.type === "text/plain");

    // Check if text content looks like markdown
    const seemsMarkdown = text && (
        text.includes("\n# ") ||
        text.includes("\n## ") ||
        text.includes("\n### ") ||
        text.includes("\n* ") ||
        text.includes("\n- ") ||
        text.includes("\n+ ") ||
        text.includes("![") ||
        text.includes("](")
    );

    // Render as markdown if it's markdown/text type OR if text looks like markdown (but not if XML)
    const shouldRenderAsMarkdown = !isXml && (isMarkdownOrText || seemsMarkdown);

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
                    className="max-w-7xl px-2 h-[calc(100vh-210px)] overflow-auto"
                    ref={textContainerRef}
                >
                    {isXml ? (
                        <div className="px-4 py-2">
                            <XMLViewer xml={text} collapsible />
                        </div>
                    ) : shouldRenderAsMarkdown ? (
                        <div className="vprose prose-sm p-1">
                            <MarkdownRenderer
                                components={{
                                    a: ({ node, ...props }: { node?: any; href?: string; children?: React.ReactNode }) => {
                                        const href = props.href || "";
                                        if (href.includes("/store/objects/")) {
                                            return (
                                                <NavLink
                                                    topLevelNav
                                                    href={href}
                                                    className="text-info"
                                                >
                                                    {props.children}
                                                </NavLink>
                                            );
                                        }
                                        return <a {...props} data-debug="test" target="_blank" rel="noopener noreferrer" />;
                                    },
                                    p: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <p {...props} className={`my-0`} />
                                    ),
                                    pre: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <pre {...props} className={`my-2 p-2 rounded`} />
                                    ),
                                    code: ({
                                        node,
                                        className,
                                        children,
                                        ...props
                                    }: {
                                        node?: any;
                                        className?: string;
                                        children?: React.ReactNode;
                                    }) => {
                                        const match = /language-(\w+)/.exec(className || "");
                                        const isInline = !match;
                                        return (
                                            <code
                                                {...props}
                                                className={
                                                    isInline
                                                        ? `px-1.5 py-0.5 rounded`
                                                        : "text-muted"
                                                }
                                            >
                                                {children}
                                            </code>
                                        );
                                    },
                                    h1: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <h1 {...props} className={`font-bold text-2xl my-2`} />
                                    ),
                                    h2: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <h2 {...props} className={`font-bold text-xl my-2`} />
                                    ),
                                    h3: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <h3 {...props} className={`font-bold text-lg my-2`} />
                                    ),
                                    li: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <li {...props} />
                                    ),
                                }}
                            >
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
                const webSupportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
                const isOriginalWebSupported = content?.type && webSupportedFormats.includes(content.type);

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
    const webSupportedFormats = ['video/mp4', 'video/webm'];
    const isOriginalWebSupported = content?.type && webSupportedFormats.includes(content.type);

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
                    className="w-full max-h-[calc(100vh-260px)] object-contain"
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
    const contentProcessorType = (object.metadata as DocumentMetadata)?.content_processor?.type;
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

function PdfPreviewPanel({ object }: { object: ContentObject }) {
    return (
        <div className="h-[calc(100vh-210px)]">
            <SimplePdfViewer
                object={object}
                className="h-full"
            />
        </div>
    );
}

function PdfProcessingPanel({ progress, status }: { progress?: DocAnalyzerProgress, status?: WorkflowExecutionStatus }) {
    const statusColor = (() => {
        switch (status) {
            case WorkflowExecutionStatus.RUNNING:
                return "text-info";
            case WorkflowExecutionStatus.COMPLETED:
                return "text-success";
            case WorkflowExecutionStatus.FAILED:
                return "text-destructive";
            case WorkflowExecutionStatus.TERMINATED:
            case WorkflowExecutionStatus.CANCELED:
                return "text-attention";
            default:
                return "text-muted";
        }
    })();

    const statusName = (() => {
        switch (status) {
            case WorkflowExecutionStatus.RUNNING: return 'Running';
            case WorkflowExecutionStatus.COMPLETED: return 'Completed';
            case WorkflowExecutionStatus.FAILED: return 'Failed';
            case WorkflowExecutionStatus.CONTINUED_AS_NEW: return 'Continued As New';
            case WorkflowExecutionStatus.TERMINATED: return 'Terminated';
            case WorkflowExecutionStatus.TIMED_OUT: return 'Timed Out';
            case WorkflowExecutionStatus.CANCELED: return 'Canceled';
            default: return 'Unknown';
        }
    })();

    return (
        <div className="px-4 py-4">
            {progress && (
                <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                        <ProgressLine name="Analyze Page" progress={progress.pages} />
                        {/* <ProgressLine name="Extract Tables" progress={progress.tables} />
                        <ProgressLine name="Describe Images" progress={progress.images} />
                        <ProgressLine name="Process Visually" progress={progress.visuals} /> */}
                    </div>
                    <div className="pt-2 text-sm text-muted">
                        Progress: {progress.percent}%
                        <span className="px-2">&bull;</span>
                        <span className={statusColor}>{statusName}</span>
                        {progress.started_at && (
                            <>
                                <span className="px-2">&bull;</span>
                                <span>{((Date.now() - progress.started_at) / 1000).toFixed(0)} sec. elapsed</span>
                            </>
                        )}
                    </div>
                    <Progress percent={progress.percent} />
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