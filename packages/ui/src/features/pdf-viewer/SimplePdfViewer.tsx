import { ContentObject } from "@vertesia/common";
import { Button, Spinner, VTooltip } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PdfPageSlider } from "./PdfPageSlider";

interface SimplePdfViewerProps {
    /** The content object containing the PDF */
    object: ContentObject;
    /** Additional CSS class names */
    className?: string;
}

/**
 * A standalone PDF viewer component that displays PDF thumbnails with navigation.
 * Fetches the PDF URL from the content object and displays it using PdfThumbnailSlider.
 * Does not depend on any magic-pdf context.
 */
export function SimplePdfViewer({ object, className }: SimplePdfViewerProps) {
    const { client } = useUserSession();
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfUrl, setPdfUrl] = useState<string>("");
    const [pdfUrlLoading, setPdfUrlLoading] = useState(true);
    const [pageCount, setPageCount] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Fetch the PDF URL from the content object
    useEffect(() => {
        const source = object.content?.source;
        if (!source) {
            setPdfUrlLoading(false);
            return;
        }

        setPdfUrlLoading(true);
        client.files.getDownloadUrl(source)
            .then((result) => {
                setPdfUrl(result.url);
            })
            .catch((err) => {
                console.error("Failed to get PDF URL:", err);
            })
            .finally(() => {
                setPdfUrlLoading(false);
            });
    }, [object.content?.source, client]);

    // Get page count from metadata or default to a reasonable number
    useEffect(() => {
        // Try to get page count from metadata
        const metadata = object.metadata as { pages?: number; page_count?: number } | undefined;
        const count = metadata?.pages || metadata?.page_count || 0;

        if (count > 0) {
            setPageCount(count);
        } else {
            // Default to 1 page - the PdfThumbnailList will update this when the PDF loads
            setPageCount(1);
        }
    }, [object.metadata]);

    if (pdfUrlLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!pdfUrl) {
        return (
            <div className="flex items-center justify-center h-full text-muted">
                No PDF available
            </div>
        );
    }

    // Fullscreen overlay
    if (isFullscreen) {
        return (
            <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
                {/* Header with close button */}
                <div className="flex h-9 items-center justify-end shrink-0 bg-sidebar px-2 border-b border-sidebar-border">
                    <Button variant="ghost" size="xs" onClick={() => setIsFullscreen(false)} alt="Close fullscreen">
                        <X className="size-4" />
                    </Button>
                </div>
                {/* PDF viewer - min-h-0 allows flex child to shrink below content size */}
                <PdfPageSlider
                    pdfUrl={pdfUrl}
                    pdfUrlLoading={pdfUrlLoading}
                    pageCount={pageCount || 100}
                    currentPage={currentPage}
                    onChange={setCurrentPage}
                    className="flex-1 min-h-0"
                />
            </div>
        );
    }

    return (
        <div className="relative h-full flex flex-col">
            <PdfPageSlider
                pdfUrl={pdfUrl}
                pdfUrlLoading={pdfUrlLoading}
                pageCount={pageCount || 100}
                currentPage={currentPage}
                onChange={setCurrentPage}
                className={className}
                compact
                headerExtra={
                    <VTooltip description="Fullscreen" placement="bottom" size="xs">
                        <button
                            className="p-1 rounded cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => setIsFullscreen(true)}
                        >
                            <Maximize2 className="size-4" />
                        </button>
                    </VTooltip>
                }
            />
        </div>
    );
}
