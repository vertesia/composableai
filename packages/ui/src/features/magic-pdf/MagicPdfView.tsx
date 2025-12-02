import { ContentObject, DocumentMetadata } from "@vertesia/common";
import { Button, ErrorBox, ResizableHandle, ResizablePanel, ResizablePanelGroup, useFetch } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { X } from "lucide-react";
import { Component, ErrorInfo, ReactNode, useState } from "react";
import { PdfPageSlider } from "../pdf-viewer/PdfPageSlider";
import { AnnotatedImageSlider } from "./AnnotatedImageSlider";
import { DownloadPopover } from "./DownloadPopover";
import { ExtractedContentView } from "./ExtractedContentView";
import { MagicPdfProvider, useMagicPdfContext } from "./MagicPdfProvider";

// Error boundary for PDF view
interface ErrorBoundaryProps {
    children: ReactNode;
    onClose?: () => void;
}
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}
class PdfViewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('PDF View error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 p-8 max-w-md">
                        <ErrorBox title="Failed to load PDF viewer">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </ErrorBox>
                        {this.props.onClose && (
                            <Button variant="outline" onClick={this.props.onClose}>
                                Close
                            </Button>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

interface MagicPdfViewProps {
    objectId: string;
    onClose?: () => void;
}
export function MagicPdfView({ objectId, onClose }: MagicPdfViewProps) {
    const { client } = useUserSession();

    const { data: object, error } = useFetch(() => client.store.objects.retrieve(objectId, "+text"), [objectId]);

    if (error) {
        return (
            <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 p-8 max-w-md">
                    <ErrorBox title="Fetching document failed">{error.message}</ErrorBox>
                    {onClose && (
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    if (!object) {
        return (
            <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <PdfViewErrorBoundary onClose={onClose}>
            <div className='fixed inset-0 bg-background z-50 flex items-center justify-center'>
                <MagicPdfProvider object={object}>
                    <MagicPdfViewImpl object={object} onClose={onClose} />
                </MagicPdfProvider>
            </div>
        </PdfViewErrorBoundary>
    );
}

interface _MagicPdfViewProps {
    object: ContentObject;
    onClose?: () => void;
}
function MagicPdfViewImpl({ object, onClose }: _MagicPdfViewProps) {
    const { count: totalPages, pdfUrl, pdfUrlLoading } = useMagicPdfContext();

    const getProcessorType = (): "xml" | "markdown" => {
        if (object.metadata?.type === "document") {
            const docMetadata = object.metadata as DocumentMetadata;
            const type = docMetadata.content_processor?.type;
            if (type === "markdown") return "markdown";
        }
        return "xml"; // default
    };

    const [pageNumber, setPageNumber] = useState(1);
    const processorType = getProcessorType();

    // XML processor: ImageSlider (annotated images) on left, XML/JSON/Markdown text on right
    // Markdown processor: PageSlider (PDF thumbnails) on left, Markdown on right
    if (processorType === "xml") {
        return (
            <ResizablePanelGroup direction="horizontal" className="absolute inset-0">
                <ResizablePanel defaultSize={50} minSize={20} maxSize={80} className="bg-muted">
                    <AnnotatedImageSlider
                        className="h-full"
                        currentPage={pageNumber}
                        onChange={setPageNumber}
                    />
                </ResizablePanel>
                <ResizableHandle className="w-[4px] bg-border cursor-ew-resize" />
                <ResizablePanel defaultSize={50} minSize={20} className="flex flex-col">
                    {/* Header */}
                    <div className="flex h-9 items-center justify-between shrink-0 bg-sidebar px-2 border-b border-sidebar-border">
                        <div className="flex items-center gap-x-2">
                            <DownloadPopover object={object} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                            Page {pageNumber} / {totalPages}
                        </span>
                        <div className="flex items-center gap-x-2">
                            {!!onClose && (
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={onClose}
                                    alt="Close"
                                >
                                    <X className='size-4' />
                                </Button>
                            )}
                        </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 overflow-auto px-2">
                        <ExtractedContentView pageNumber={pageNumber} viewType="xml" />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        );
    }

    // Markdown processor: PDF thumbnails on left, Markdown on right
    return (
        <ResizablePanelGroup direction="horizontal" className="absolute inset-0">
            <ResizablePanel defaultSize={50} minSize={20} maxSize={80} className="bg-muted">
                <PdfPageSlider
                        pdfUrl={pdfUrl}
                        pdfUrlLoading={pdfUrlLoading}
                        pageCount={totalPages}
                        className="h-full"
                        currentPage={pageNumber}
                        onChange={setPageNumber}
                    />
            </ResizablePanel>
            <ResizableHandle className="w-[4px] bg-border cursor-ew-resize" />
            <ResizablePanel defaultSize={50} minSize={20} className="flex flex-col">
                {/* Header */}
                <div className="flex h-9 items-center justify-between shrink-0 bg-sidebar px-2 border-b border-sidebar-border">
                    <div className="flex items-center gap-x-2">
                        <DownloadPopover object={object} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                        Page {pageNumber} / {totalPages}
                    </span>
                    <div className="flex items-center gap-x-2">
                        {!!onClose && (
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={onClose}
                                alt="Close"
                            >
                                <X className='size-4' />
                            </Button>
                        )}
                    </div>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-auto px-2">
                    <ExtractedContentView pageNumber={pageNumber} viewType="markdown" />
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}
