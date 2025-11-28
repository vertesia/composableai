import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
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
    /** Optional ref to the scroll container. If not provided, will search for scrollable ancestor. */
    scrollContainerRef?: React.RefObject<HTMLElement | null>;
    /** Callback when aspect ratio is determined from the PDF. Useful for synchronizing placeholder sizing. */
    onAspectRatioChange?: (aspectRatio: number) => void;
}

/**
 * Virtualized PDF thumbnail that only renders the Page when visible.
 * Uses IntersectionObserver for efficient visibility detection.
 */
function VirtualizedThumbnail({
    pageNumber,
    width,
    isSelected,
    onSelect,
    renderThumbnail,
    aspectRatio = A4_ASPECT_RATIO,
    rootMargin = '200px 0px'
}: {
    pageNumber: number;
    width?: number;
    isSelected: boolean;
    onSelect: () => void;
    renderThumbnail: PdfThumbnailListProps['renderThumbnail'];
    aspectRatio?: number;
    rootMargin?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hasBeenVisible, setHasBeenVisible] = useState(false);

    // Set up intersection observer
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry?.isIntersecting) {
                    setHasBeenVisible(true);
                }
            },
            { rootMargin, threshold: 0 }
        );

        observer.observe(container);
        return () => observer.disconnect();
    }, [rootMargin]);

    const placeholderHeight = width ? Math.round(width / aspectRatio) : 200;

    // Only render the actual Page component if visible or has been visible
    // Once rendered, keep it rendered to preserve the canvas
    const shouldRenderPage = hasBeenVisible;

    const pageElement = shouldRenderPage ? (
        <Page
            pageNumber={pageNumber}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={
                <div
                    className="flex items-center justify-center bg-gray-100 dark:bg-gray-800"
                    style={{ height: placeholderHeight }}
                >
                    <LoadingSpinner size="sm" />
                </div>
            }
        />
    ) : (
        <div
            className="flex items-center justify-center bg-gray-100 dark:bg-gray-800"
            style={{ height: placeholderHeight, width: width || '100%' }}
        >
            <span className="text-gray-400 text-xs">{pageNumber}</span>
        </div>
    );

    return (
        <div ref={containerRef}>
            {renderThumbnail({
                pageNumber,
                isSelected,
                pageElement,
                onSelect
            })}
        </div>
    );
}

/**
 * Renders a list of PDF page thumbnails using a single Document.
 * Uses windowed virtualization for better performance with large PDFs.
 * Only renders components for pages within a window around the current scroll position.
 */
// Helper to find the scrollable ancestor element
function findScrollableAncestor(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null;

    let current = element.parentElement;
    while (current) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

export function PdfThumbnailList({
    pdfUrl,
    urlLoading = false,
    pageCount,
    currentPage,
    thumbnailWidth,
    onPageSelect,
    renderThumbnail,
    scrollContainerRef,
    onAspectRatioChange
}: PdfThumbnailListProps) {
    const [error, setError] = useState<Error | null>(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(15, pageCount) });
    // Start with null to indicate we haven't loaded the PDF yet
    const [aspectRatio, setAspectRatio] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleError = useCallback((err: Error) => {
        setError(err);
    }, []);

    // Get actual page dimensions from PDF on load
    const handleLoadSuccess = useCallback(async (pdf: PDFDocumentProxy) => {
        try {
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            const ratio = viewport.width / viewport.height;
            setAspectRatio(ratio);
            onAspectRatioChange?.(ratio);
        } catch (err) {
            console.error('Failed to get page dimensions:', err);
            // Fall back to A4 if we can't get dimensions
            setAspectRatio(A4_ASPECT_RATIO);
            onAspectRatioChange?.(A4_ASPECT_RATIO);
        }
    }, [onAspectRatioChange]);

    // Use A4 as fallback if aspect ratio not yet determined
    const effectiveAspectRatio = aspectRatio ?? A4_ASPECT_RATIO;

    // Calculate placeholder height using actual aspect ratio from PDF
    const placeholderHeight = thumbnailWidth ? Math.round(thumbnailWidth / effectiveAspectRatio) : 200;
    // Total height per item including padding (p-2 = 8px top + 8px bottom) + page number text (~24px) + gap
    const itemHeight = placeholderHeight + 16 + 24 + 8;

    // Window size: how many pages to render above and below visible area
    const WINDOW_BUFFER = 5;

    // Track scroll position to update visible range
    useEffect(() => {
        // Find the scroll container - either from prop or by searching ancestors
        const container = scrollContainerRef?.current || findScrollableAncestor(containerRef.current);
        if (!container) return;

        const updateVisibleRange = () => {
            const scrollTop = container.scrollTop;
            const viewportHeight = container.clientHeight;

            // Calculate which pages are visible
            const firstVisible = Math.floor(scrollTop / itemHeight);
            const lastVisible = Math.ceil((scrollTop + viewportHeight) / itemHeight);

            // Add buffer around visible range
            const start = Math.max(0, firstVisible - WINDOW_BUFFER);
            const end = Math.min(pageCount, lastVisible + WINDOW_BUFFER);

            setVisibleRange(prev => {
                if (prev.start !== start || prev.end !== end) {
                    return { start, end };
                }
                return prev;
            });
        };

        // Initial calculation
        updateVisibleRange();

        // Listen to scroll events
        container.addEventListener('scroll', updateVisibleRange, { passive: true });
        return () => container.removeEventListener('scroll', updateVisibleRange);
    }, [itemHeight, pageCount, scrollContainerRef]);

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

    // Calculate spacer heights for virtual scrolling
    const topSpacerHeight = visibleRange.start * itemHeight;
    const bottomSpacerHeight = (pageCount - visibleRange.end) * itemHeight;

    // Only render the virtualized list once we have the actual aspect ratio
    // This prevents the total scroll height from changing after initial render
    const hasAspectRatio = aspectRatio !== null;

    return (
        <div ref={containerRef}>
            <Document
                file={pdfUrl}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={handleError}
                loading={<LoadingSpinner className="py-4" size="md" />}
            >
                {hasAspectRatio ? (
                    <>
                        {/* Top spacer for pages above visible window */}
                        {topSpacerHeight > 0 && (
                            <div style={{ height: topSpacerHeight }} />
                        )}

                        {/* Only render pages within the visible window */}
                        {Array.from({ length: visibleRange.end - visibleRange.start }, (_, index) => {
                            const pageNumber = visibleRange.start + index + 1;
                            return (
                                <div key={pageNumber} style={{ height: itemHeight, overflow: 'hidden' }}>
                                    <VirtualizedThumbnail
                                        pageNumber={pageNumber}
                                        width={thumbnailWidth}
                                        isSelected={pageNumber === currentPage}
                                        onSelect={() => onPageSelect(pageNumber)}
                                        renderThumbnail={renderThumbnail}
                                        aspectRatio={effectiveAspectRatio}
                                    />
                                </div>
                            );
                        })}

                        {/* Bottom spacer for pages below visible window */}
                        {bottomSpacerHeight > 0 && (
                            <div style={{ height: bottomSpacerHeight }} />
                        )}
                    </>
                ) : (
                    <LoadingSpinner className="py-4" size="md" />
                )}
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
