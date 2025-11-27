import { useState, useEffect, createContext, useContext } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';

// Configure PDF.js worker - use CDN for the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Loading spinner component
function LoadingSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8'
    };
    return (
        <div className={`flex items-center justify-center ${className || ''}`}>
            <Loader2 className={`${sizeClasses[size]} animate-spin text-gray-400`} />
        </div>
    );
}

interface PdfPageRendererProps {
    pdfUrl: string;
    pageNumber: number;
    width?: number;
    className?: string;
    renderTextLayer?: boolean;
    renderAnnotationLayer?: boolean;
    onLoadSuccess?: (numPages: number) => void;
    onError?: (error: Error) => void;
}

export function PdfPageRenderer({
    pdfUrl,
    pageNumber,
    width,
    className,
    renderTextLayer = false,
    renderAnnotationLayer = false,
    onLoadSuccess,
    onError
}: PdfPageRendererProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
        setLoading(false);
        onLoadSuccess?.(numPages);
    };

    const handleError = (err: Error) => {
        setLoading(false);
        setError(err);
        onError?.(err);
    };

    if (error) {
        return (
            <div className={`flex items-center justify-center text-red-500 text-sm ${className || ''}`}>
                Failed to load PDF
            </div>
        );
    }

    return (
        <div className={className}>
            {loading && (
                <LoadingSpinner className="py-4" size="md" />
            )}
            <Document
                file={pdfUrl}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={handleError}
                loading={null}
            >
                <Page
                    pageNumber={pageNumber}
                    width={width}
                    renderTextLayer={renderTextLayer}
                    renderAnnotationLayer={renderAnnotationLayer}
                    loading={<LoadingSpinner className="py-4" size="sm" />}
                />
            </Document>
        </div>
    );
}

// Page dimensions from PDF
interface PageDimensions {
    width: number;
    height: number;
    aspectRatio: number;
}

// PDF document proxy type
interface PDFDocumentProxy {
    numPages: number;
    getPage: (pageNum: number) => Promise<{ getViewport: (options: { scale: number }) => { width: number; height: number } }>;
}

// Context for sharing PDF state
interface SharedPdfContextValue {
    pdfUrl: string;
    numPages: number;
    loading: boolean;
    error: Error | null;
    pageDimensions: PageDimensions | null;
}

const SharedPdfContext = createContext<SharedPdfContextValue | null>(null);

interface SharedPdfProviderProps {
    pdfUrl: string;
    urlLoading?: boolean;
    children: (renderPage: (pageNumber: number, width?: number) => React.ReactNode) => React.ReactNode;
    onLoadSuccess?: (numPages: number) => void;
}

/**
 * Provider that loads a PDF once using a single Document component.
 * Children receive a renderPage function to render pages inside the Document.
 */
export function SharedPdfProvider({ pdfUrl, urlLoading = false, children, onLoadSuccess }: SharedPdfProviderProps) {
    const [numPages, setNumPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [pageDimensions, setPageDimensions] = useState<PageDimensions | null>(null);

    const handleLoadSuccess = async (pdf: PDFDocumentProxy) => {
        setNumPages(pdf.numPages);
        onLoadSuccess?.(pdf.numPages);

        try {
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            setPageDimensions({
                width: viewport.width,
                height: viewport.height,
                aspectRatio: viewport.width / viewport.height
            });
        } catch (err) {
            console.error('Failed to get page dimensions:', err);
        }

        setLoading(false);
    };

    const handleError = (err: Error) => {
        setLoading(false);
        setError(err);
    };

    const isLoading = urlLoading || (pdfUrl ? loading : true);

    const value: SharedPdfContextValue = {
        pdfUrl,
        numPages,
        loading: isLoading,
        error,
        pageDimensions
    };

    // Render function that children use to render pages
    const renderPage = (pageNumber: number, width?: number) => (
        <Page
            key={pageNumber}
            pageNumber={pageNumber}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={<LoadingSpinner className="py-4" size="sm" />}
        />
    );

    if (error) {
        return (
            <div className="flex items-center justify-center text-red-500 text-sm py-4">
                Failed to load PDF
            </div>
        );
    }

    return (
        <SharedPdfContext.Provider value={value}>
            {pdfUrl ? (
                <Document
                    file={pdfUrl}
                    onLoadSuccess={handleLoadSuccess}
                    onLoadError={handleError}
                    loading={<LoadingSpinner className="py-4" size="md" />}
                >
                    {children(renderPage)}
                </Document>
            ) : (
                <LoadingSpinner className="py-4" size="md" />
            )}
        </SharedPdfContext.Provider>
    );
}

export function useSharedPdf() {
    return useContext(SharedPdfContext);
}

// A4 portrait aspect ratio
const A4_ASPECT_RATIO = 210 / 297;

interface SimplePdfPageProps {
    pageNumber: number;
    width?: number;
    className?: string;
}

/**
 * Simple wrapper for a PDF page that adds styling.
 * Must be used inside SharedPdfProvider's children render function.
 */
export function SimplePdfPage({ pageNumber, width, className }: SimplePdfPageProps) {
    const context = useSharedPdf();
    const aspectRatio = context?.pageDimensions?.aspectRatio ?? A4_ASPECT_RATIO;
    const placeholderHeight = width ? Math.round(width / aspectRatio) : 200;

    if (context?.loading) {
        return (
            <div
                className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className || ''}`}
                style={{ height: placeholderHeight, width: width || '100%' }}
            >
                <LoadingSpinner size="md" />
            </div>
        );
    }

    return (
        <div className={className}>
            <Page
                pageNumber={pageNumber}
                width={width}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={<LoadingSpinner className="py-4" size="sm" />}
            />
        </div>
    );
}

interface PdfThumbnailListProps {
    pdfUrl: string;
    urlLoading?: boolean;
    pageCount: number;
    currentPage: number;
    thumbnailWidth?: number;
    onPageSelect: (pageNumber: number) => void;
    renderThumbnail: (props: {
        pageNumber: number;
        isSelected: boolean;
        pageElement: React.ReactNode;
        onSelect: () => void;
    }) => React.ReactNode;
}

/**
 * Renders a list of PDF page thumbnails using a single Document.
 * This ensures the PDF is only downloaded once.
 */
export function PdfThumbnailList({
    pdfUrl,
    urlLoading = false,
    pageCount,
    currentPage,
    thumbnailWidth,
    onPageSelect,
    renderThumbnail
}: PdfThumbnailListProps) {
    const [error, setError] = useState<Error | null>(null);

    const handleError = (err: Error) => {
        setError(err);
    };

    if (error) {
        return (
            <div className="flex items-center justify-center text-red-500 text-sm py-4">
                Failed to load PDF
            </div>
        );
    }

    if (urlLoading || !pdfUrl) {
        return <LoadingSpinner className="py-4" size="md" />;
    }

    return (
        <Document
            file={pdfUrl}
            onLoadError={handleError}
            loading={<LoadingSpinner className="py-4" size="md" />}
        >
            {Array.from({ length: pageCount }, (_, index) => {
                const pageNumber = index + 1;
                const pageElement = (
                    <Page
                        pageNumber={pageNumber}
                        width={thumbnailWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={
                            <div
                                className="flex items-center justify-center bg-gray-100 dark:bg-gray-800"
                                style={{ height: thumbnailWidth ? Math.round(thumbnailWidth / A4_ASPECT_RATIO) : 200 }}
                            >
                                <LoadingSpinner size="sm" />
                            </div>
                        }
                    />
                );

                return renderThumbnail({
                    pageNumber,
                    isSelected: pageNumber === currentPage,
                    pageElement,
                    onSelect: () => onPageSelect(pageNumber)
                });
            })}
        </Document>
    );
}

interface PdfDocumentRendererProps {
    pdfUrl: string;
    pageNumber: number;
    width?: number;
    height?: number;
    className?: string;
    renderTextLayer?: boolean;
    renderAnnotationLayer?: boolean;
    onPageChange?: (pageNumber: number, totalPages: number) => void;
}

export function PdfDocumentRenderer({
    pdfUrl,
    pageNumber,
    width,
    height,
    className,
    renderTextLayer = false,
    renderAnnotationLayer = false,
    onPageChange
}: PdfDocumentRendererProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (numPages > 0) {
            onPageChange?.(pageNumber, numPages);
        }
    }, [pageNumber, numPages, onPageChange]);

    const handleLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
        setNumPages(pages);
        setLoading(false);
    };

    const handleError = (err: Error) => {
        setLoading(false);
        setError(err);
    };

    if (error) {
        return (
            <div className={`flex items-center justify-center text-red-500 ${className || ''}`}>
                <span>Failed to load PDF: {error.message}</span>
            </div>
        );
    }

    return (
        <div className={className}>
            {loading && (
                <LoadingSpinner className="py-8" size="lg" />
            )}
            <Document
                file={pdfUrl}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={handleError}
                loading={null}
            >
                <Page
                    pageNumber={Math.min(pageNumber, numPages || 1)}
                    width={width}
                    height={height}
                    renderTextLayer={renderTextLayer}
                    renderAnnotationLayer={renderAnnotationLayer}
                    loading={<LoadingSpinner className="py-8" size="md" />}
                />
            </Document>
        </div>
    );
}
