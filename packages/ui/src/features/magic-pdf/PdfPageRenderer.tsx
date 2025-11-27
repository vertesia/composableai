import { useState, useEffect, useRef, createContext, useContext, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';

// Configure PDF.js worker - use CDN for the worker
// PDF.js automatically handles heavy operations in a Web Worker thread
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
    aspectRatio: number; // width / height
}

// Context for sharing a PDF document across multiple page renders
interface SharedPdfContextValue {
    pdfUrl: string;
    numPages: number;
    loading: boolean;
    error: Error | null;
    /** First page dimensions (most PDFs have uniform page sizes) */
    pageDimensions: PageDimensions | null;
}

const SharedPdfContext = createContext<SharedPdfContextValue | null>(null);

interface SharedPdfProviderProps {
    pdfUrl: string;
    /** Whether the PDF URL is still being fetched */
    urlLoading?: boolean;
    children: React.ReactNode;
    onLoadSuccess?: (numPages: number) => void;
}

/**
 * Provider that loads a PDF once and shares it across multiple page renderers.
 * Use this when rendering multiple thumbnails from the same PDF to avoid
 * loading the PDF multiple times.
 */
export function SharedPdfProvider({ pdfUrl, urlLoading = false, children, onLoadSuccess }: SharedPdfProviderProps) {
    const [numPages, setNumPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [pageDimensions, setPageDimensions] = useState<PageDimensions | null>(null);

    const handleLoadSuccess = async (pdf: { numPages: number; getPage: (pageNum: number) => Promise<{ getViewport: (options: { scale: number }) => { width: number; height: number } }> }) => {
        setNumPages(pdf.numPages);
        onLoadSuccess?.(pdf.numPages);

        // Get first page dimensions using pdfjs
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

    // Loading is true if URL is still being fetched OR if we have URL but document hasn't loaded
    const isLoading = urlLoading || (pdfUrl ? loading : true);

    const value = useMemo(() => ({
        pdfUrl,
        numPages,
        loading: isLoading,
        error,
        pageDimensions
    }), [pdfUrl, numPages, isLoading, error, pageDimensions]);

    return (
        <SharedPdfContext.Provider value={value}>
            {/* Hidden document loader - only render when URL is available */}
            {pdfUrl && (
                <div style={{ display: 'none' }}>
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={handleLoadSuccess}
                        onLoadError={handleError}
                        loading={null}
                    />
                </div>
            )}
            {children}
        </SharedPdfContext.Provider>
    );
}

export function useSharedPdf() {
    return useContext(SharedPdfContext);
}

interface SharedPdfPageProps {
    pageNumber: number;
    width?: number;
    height?: number;
    className?: string;
    renderTextLayer?: boolean;
    renderAnnotationLayer?: boolean;
}

/**
 * Renders a single page from a shared PDF document.
 * Must be used within a SharedPdfProvider.
 */
export function SharedPdfPage({
    pageNumber,
    width,
    height,
    className,
    renderTextLayer = false,
    renderAnnotationLayer = false
}: SharedPdfPageProps) {
    const context = useSharedPdf();

    if (!context) {
        return (
            <div className={`flex items-center justify-center text-red-500 text-sm ${className || ''}`}>
                SharedPdfPage must be used within SharedPdfProvider
            </div>
        );
    }

    const { pdfUrl, loading, error } = context;

    if (error) {
        return (
            <div className={`flex items-center justify-center text-red-500 text-sm ${className || ''}`}>
                Failed to load PDF
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`flex items-center justify-center py-8 ${className || ''}`}>
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className={className}>
            <Document file={pdfUrl} loading={null}>
                <Page
                    pageNumber={pageNumber}
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

// A4 portrait aspect ratio: width / height = 210mm / 297mm ≈ 0.707
const A4_ASPECT_RATIO = 210 / 297;

interface VirtualizedPdfPageProps {
    pageNumber: number;
    width?: number;
    height?: number;
    className?: string;
    renderTextLayer?: boolean;
    renderAnnotationLayer?: boolean;
    /** Root margin for intersection observer (loads pages before they're visible) */
    rootMargin?: string;
}

/**
 * Virtualized PDF page that only renders when visible in the viewport.
 * Uses IntersectionObserver to detect visibility and renders a placeholder
 * when not visible. This significantly improves performance for large documents.
 *
 * Must be used within a SharedPdfProvider.
 */
export function VirtualizedPdfPage({
    pageNumber,
    width,
    height,
    className,
    renderTextLayer = false,
    renderAnnotationLayer = false,
    rootMargin = '200px 0px' // Pre-load pages 200px before they enter viewport
}: VirtualizedPdfPageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [hasBeenVisible, setHasBeenVisible] = useState(false);
    const context = useSharedPdf();

    // Set up intersection observer
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry) {
                    setIsVisible(entry.isIntersecting);
                    if (entry.isIntersecting) {
                        setHasBeenVisible(true);
                    }
                }
            },
            {
                rootMargin,
                threshold: 0
            }
        );

        observer.observe(container);

        return () => {
            observer.disconnect();
        };
    }, [rootMargin]);

    if (!context) {
        return (
            <div className={`flex items-center justify-center text-red-500 text-sm ${className || ''}`}>
                VirtualizedPdfPage must be used within SharedPdfProvider
            </div>
        );
    }

    const { pdfUrl, loading, error, pageDimensions } = context;

    if (error) {
        return (
            <div className={`flex items-center justify-center text-red-500 text-sm ${className || ''}`}>
                Failed to load PDF
            </div>
        );
    }

    // Use actual PDF aspect ratio from context, fallback to A4
    const aspectRatio = pageDimensions?.aspectRatio ?? A4_ASPECT_RATIO;
    // Calculate placeholder height based on aspect ratio
    const placeholderHeight = width ? Math.round(width / aspectRatio) : 200;

    // Show placeholder when:
    // 1. PDF is still loading globally
    // 2. Page has never been visible (not yet scrolled to)
    // 3. Page was visible but is now out of view (keep placeholder with actual height)
    const showPlaceholder = loading || (!isVisible && !hasBeenVisible);

    if (showPlaceholder) {
        return (
            <div
                ref={containerRef}
                className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className || ''}`}
                style={{
                    height: placeholderHeight,
                    width: width || '100%'
                }}
            >
                {loading ? (
                    <LoadingSpinner size="md" />
                ) : (
                    <span className="text-gray-400 text-sm">Page {pageNumber}</span>
                )}
            </div>
        );
    }

    // Once visible, render the actual page
    // Keep rendering even when scrolled away to preserve the canvas (if hasBeenVisible)
    // Use explicit dimensions to prevent layout shift during re-render
    const containerStyle: React.CSSProperties = {
        width: width || '100%',
        // Set min-height based on aspect ratio to prevent collapse during re-render
        minHeight: width ? Math.round(width / aspectRatio) : undefined,
        overflow: 'hidden'
    };

    return (
        <div ref={containerRef} className={className} style={containerStyle}>
            <Document file={pdfUrl} loading={null}>
                <Page
                    pageNumber={pageNumber}
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

/**
 * A more complete PDF document renderer that manages the document state
 * and provides callbacks for page changes.
 */
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
