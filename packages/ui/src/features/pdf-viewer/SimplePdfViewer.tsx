import { ContentObject } from "@vertesia/common";
import { Spinner } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useEffect, useState } from "react";
import { PdfThumbnailSlider } from "./PdfThumbnailSlider";

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

    return (
        <PdfThumbnailSlider
            pdfUrl={pdfUrl}
            pdfUrlLoading={pdfUrlLoading}
            pageCount={pageCount || 100} // Use a high default if we don't know the count
            currentPage={currentPage}
            onChange={setCurrentPage}
            className={className}
            compact
        />
    );
}
