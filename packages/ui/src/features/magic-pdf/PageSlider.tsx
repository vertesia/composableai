import { usePdfPagesInfo } from "./PdfPageProvider";
import { PdfThumbnailSlider } from "../pdf-viewer/PdfThumbnailSlider";

interface PageSliderProps {
    currentPage: number;
    onChange: (pageNumber: number) => void;
    className?: string;
    /** Compact mode reduces padding and navigation bar heights */
    compact?: boolean;
}

/**
 * PDF page slider that uses the PdfPageProvider context.
 * This is a thin wrapper around PdfThumbnailSlider that gets data from context.
 */
export function PageSlider({ className, currentPage, onChange, compact = false }: PageSliderProps) {
    const { pdfUrl, pdfUrlLoading, count } = usePdfPagesInfo();

    return (
        <PdfThumbnailSlider
            pdfUrl={pdfUrl}
            pdfUrlLoading={pdfUrlLoading}
            pageCount={count}
            currentPage={currentPage}
            onChange={onChange}
            className={className}
            compact={compact}
        />
    );
}
