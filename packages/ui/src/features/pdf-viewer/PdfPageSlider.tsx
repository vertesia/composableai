import { Button, Center, VTooltip } from "@vertesia/ui/core";
import clsx from "clsx";
import { ChevronsDown, ChevronsUp, Maximize, Minus, Plus } from "lucide-react";
import { ReactNode, useRef, useEffect, useState, useCallback, KeyboardEvent } from "react";
import { PdfThumbnailList } from "./PdfPageRenderer";

// A4 portrait aspect ratio - used as fallback
const A4_ASPECT_RATIO = 210 / 297;

// Zoom levels as percentages (100 = fit to width)
const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200, 300];
const DEFAULT_ZOOM = 100;

interface PdfPageSliderProps {
    /** URL to the PDF file */
    pdfUrl: string;
    /** Whether the PDF URL is still loading */
    pdfUrlLoading?: boolean;
    /** Total number of pages in the PDF */
    pageCount: number;
    /** Currently selected page number (1-indexed) */
    currentPage: number;
    /** Callback when page selection changes */
    onChange: (pageNumber: number) => void;
    /** Additional CSS class names */
    className?: string;
    /** Compact mode reduces padding and navigation bar heights */
    compact?: boolean;
    /** Extra content to render in the header (e.g., fullscreen button) */
    headerExtra?: ReactNode;
}

/**
 * Standalone PDF thumbnail slider component.
 * Displays a vertical list of PDF page thumbnails with navigation controls.
 * Does not depend on any context - all data is passed via props.
 */
export function PdfPageSlider({
    pdfUrl,
    pdfUrlLoading = false,
    pageCount,
    currentPage,
    onChange,
    className,
    compact = false,
    headerExtra
}: PdfPageSliderProps) {
    const ref = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [baseWidth, setBaseWidth] = useState<number | undefined>(undefined);
    const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
    const [aspectRatio, setAspectRatio] = useState<number>(A4_ASPECT_RATIO);
    // Track the actual item height from PdfThumbnailList for accurate scroll calculations
    const [itemHeight, setItemHeight] = useState<number | null>(null);

    // Track the previous item height to preserve scroll position during resize
    const prevItemHeightRef = useRef<number | null>(null);

    // Calculate thumbnail width based on zoom level
    const thumbnailWidth = baseWidth ? Math.round(baseWidth * zoom / 100) : undefined;

    const zoomIn = useCallback(() => {
        let currentIndex = ZOOM_LEVELS.findIndex(level => level >= zoom);
        if (currentIndex === -1) {
            currentIndex = ZOOM_LEVELS.length - 1;
        }
        const nextIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
        setZoom(ZOOM_LEVELS[nextIndex]);
    }, [zoom]);

    const zoomOut = useCallback(() => {
        let currentIndex = ZOOM_LEVELS.findIndex(level => level >= zoom);
        if (currentIndex === -1) {
            currentIndex = ZOOM_LEVELS.length - 1;
        }
        const prevIndex = Math.max(currentIndex - 1, 0);
        setZoom(ZOOM_LEVELS[prevIndex]);
    }, [zoom]);

    const fitToView = useCallback(() => {
        setZoom(DEFAULT_ZOOM);
    }, []);

    // Calculate item height based on placeholder height - this must match the renderThumbnail layout
    // padding (p-1=8 or p-2=16) + text height (~16-20 for compact, ~24 for normal) + gap (gap-1=4 or gap-2=8)
    const calculateItemHeight = useCallback((placeholderHeight: number) => {
        const extraHeight = compact ? 8 + 16 + 4 : 16 + 24 + 8;
        return placeholderHeight + extraHeight;
    }, [compact]);

    // Legacy function for resize preservation - kept for backwards compatibility
    const getItemHeight = (width: number | undefined, ratio: number) => {
        const placeholderHeight = width ? Math.round(width / ratio) : 200;
        return calculateItemHeight(placeholderHeight);
    };

    // Single ResizeObserver at parent level to measure thumbnail width
    // Debounced to avoid excessive re-renders during resize
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const getAvailableWidth = () => {
            // Container width minus padding (px-2 = 8px each side) minus thumbnail padding (p-2 = 8px each side) minus border (2px each side)
            return container.clientWidth - 16 - 16 - 4;
        };

        const updateWidth = () => {
            const newWidth = getAvailableWidth();
            if (newWidth <= 0) return;

            // Before updating width, preserve scroll position by calculating which page is at top
            const oldItemHeight = prevItemHeightRef.current;
            if (oldItemHeight && oldItemHeight > 0) {
                const currentScrollTop = container.scrollTop;
                const currentTopPage = Math.round(currentScrollTop / oldItemHeight);

                // Calculate new item height and adjust scroll position
                const newItemHeight = getItemHeight(newWidth, aspectRatio);
                const newScrollTop = currentTopPage * newItemHeight;

                // Update width first, then scroll
                setBaseWidth(newWidth);

                // Use requestAnimationFrame to scroll after the DOM updates
                requestAnimationFrame(() => {
                    container.scrollTo({ top: newScrollTop, behavior: 'instant' });
                });

                prevItemHeightRef.current = newItemHeight;
            } else {
                setBaseWidth(newWidth);
                prevItemHeightRef.current = getItemHeight(newWidth, aspectRatio);
            }
        };

        // Initial width update
        const initialWidth = getAvailableWidth();
        if (initialWidth > 0) {
            setBaseWidth(initialWidth);
            prevItemHeightRef.current = getItemHeight(initialWidth, aspectRatio);
        }

        const handleResize = () => {
            // Debounce width updates to avoid re-rendering PDFs during resize
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(updateWidth, 150);
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            resizeObserver.disconnect();
        };
    }, [aspectRatio]);

    // Track whether we're programmatically scrolling to avoid feedback loops
    const isProgrammaticScrollRef = useRef(false);

    // Track pending zoom scroll - we need to wait for itemHeight to update after zoom change
    const pendingZoomScrollRef = useRef<{ targetPage: number } | null>(null);

    // When zoom changes, mark that we need to scroll after itemHeight updates
    const prevZoomRef = useRef(zoom);
    useEffect(() => {
        if (prevZoomRef.current !== zoom) {
            prevZoomRef.current = zoom;
            // Mark that we need to scroll to current page after itemHeight updates
            pendingZoomScrollRef.current = { targetPage: currentPage };
            isProgrammaticScrollRef.current = true;
        }
    }, [zoom, currentPage]);

    // When itemHeight changes (after zoom), perform the pending scroll
    useEffect(() => {
        const container = scrollContainerRef.current;
        const pendingScroll = pendingZoomScrollRef.current;

        if (pendingScroll && container && itemHeight) {
            pendingZoomScrollRef.current = null;

            // Calculate scroll position using the NEW itemHeight
            const targetScrollTop = (pendingScroll.targetPage - 1) * itemHeight;

            // Use requestAnimationFrame to ensure DOM is updated
            requestAnimationFrame(() => {
                container.scrollTo({ top: targetScrollTop, behavior: 'instant' });
                // Reset after scroll completes
                requestAnimationFrame(() => {
                    isProgrammaticScrollRef.current = false;
                });
            });
        }
    }, [itemHeight]);

    // Track if we've done the initial scroll on mount
    const hasInitialScrolledRef = useRef(false);

    // Initial scroll to current page when component mounts and itemHeight becomes available
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !itemHeight || hasInitialScrolledRef.current) return;

        // Only do initial scroll if not on page 1
        if (currentPage > 1) {
            hasInitialScrolledRef.current = true;
            isProgrammaticScrollRef.current = true;

            const targetScrollTop = (currentPage - 1) * itemHeight;
            container.scrollTo({ top: targetScrollTop, behavior: 'instant' });

            requestAnimationFrame(() => {
                isProgrammaticScrollRef.current = false;
            });
        } else {
            hasInitialScrolledRef.current = true;
        }
    }, [itemHeight, currentPage]);

    // Jump to current page when it changes (user navigation)
    // Use a ref to track the previous page to avoid scrolling on resize
    const prevPageRef = useRef(currentPage);
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !itemHeight) return;

        // Only scroll if the page actually changed (user navigation)
        if (prevPageRef.current !== currentPage) {
            prevPageRef.current = currentPage;

            // Mark as programmatic scroll to avoid triggering onChange
            isProgrammaticScrollRef.current = true;

            // Calculate scroll position directly using itemHeight
            // This is more reliable than DOM queries since virtualization uses spacers
            const targetScrollTop = (currentPage - 1) * itemHeight;
            container.scrollTo({ top: targetScrollTop, behavior: 'instant' });

            // Reset after a short delay to allow scroll event to fire
            requestAnimationFrame(() => {
                isProgrammaticScrollRef.current = false;
            });
        }
    }, [currentPage, itemHeight]);

    // Update current page based on scroll position
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !itemHeight) return;

        let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

        const handleScroll = () => {
            // Skip if this is a programmatic scroll
            if (isProgrammaticScrollRef.current) return;

            // Debounce scroll updates
            if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
            scrollDebounceTimer = setTimeout(() => {
                // Calculate current page from scroll position using itemHeight
                // This is more reliable than DOM queries since virtualization uses spacers
                const scrollTop = container.scrollTop;
                const calculatedPage = Math.round(scrollTop / itemHeight) + 1;

                // Clamp to valid range and update if different
                const clampedPage = Math.max(1, Math.min(calculatedPage, pageCount));
                if (clampedPage !== currentPage) {
                    prevPageRef.current = clampedPage;
                    onChange(clampedPage);
                }
            }, 50);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
            container.removeEventListener('scroll', handleScroll);
        };
    }, [itemHeight, pageCount, currentPage, onChange]);

    const goPrev = () => {
        if (currentPage > 1) {
            onChange(currentPage - 1);
        }
    }
    const goNext = () => {
        if (currentPage < pageCount) {
            onChange(currentPage + 1);
        }
    }

    return (
        <div ref={ref} className={clsx('flex flex-col items-stretch', compact ? 'gap-y-1' : 'gap-y-2', className)}>
            <div className={clsx("relative flex items-center justify-center px-2", compact ? "h-6" : "h-9")}>
                <Button variant="ghost" size="xs" onClick={goPrev} alt="Previous page">
                    <ChevronsUp className='size-4' />
                </Button>
                <div className="absolute left-2 flex items-center gap-x-1">
                    <ZoomControls
                        zoom={zoom}
                        onZoomIn={zoomIn}
                        onZoomOut={zoomOut}
                        onFitToView={fitToView}
                        canZoomIn={zoom < ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                        canZoomOut={zoom > ZOOM_LEVELS[0]}
                    />
                    {headerExtra && (
                        <>
                            <div className="w-px h-4 bg-border mx-1" />
                            {headerExtra}
                        </>
                    )}
                </div>
                <div className="absolute right-2">
                    <PageNavigator currentPage={currentPage} totalPages={pageCount} onChange={onChange} />
                </div>
            </div>
            <div ref={scrollContainerRef} className={clsx('flex flex-col items-center flex-1 overflow-y-auto px-2', compact ? 'gap-1' : 'gap-2')}>
                <PdfThumbnailList
                    pdfUrl={pdfUrl}
                    urlLoading={pdfUrlLoading}
                    pageCount={pageCount}
                    currentPage={currentPage}
                    thumbnailWidth={thumbnailWidth}
                    onPageSelect={onChange}
                    scrollContainerRef={scrollContainerRef}
                    onAspectRatioChange={setAspectRatio}
                    onItemHeightChange={setItemHeight}
                    calculateItemHeight={calculateItemHeight}
                    renderThumbnail={({ pageNumber, isSelected, pageElement, onSelect }) => (
                        <div key={pageNumber} className={clsx("hover:bg-muted rounded-md w-full", compact ? "p-1" : "p-2")}>
                            <div
                                className={clsx('relative border-[2px] cursor-pointer overflow-hidden', isSelected ? "border-primary" : "border-border")}
                                onClick={onSelect}
                            >
                                {pageElement}
                            </div>
                            <Center className={clsx("text-muted-foreground font-semibold", compact ? "text-xs pt-0.5" : "text-sm pt-1")}>{pageNumber}</Center>
                        </div>
                    )}
                />
            </div>
            <div className={clsx("flex items-center justify-center", compact ? "h-6" : "h-9")}>
                <Button variant="ghost" size="xs" onClick={goNext} alt="Next page">
                    <ChevronsDown className='size-4' />
                </Button>
            </div>
        </div>
    )
}

interface PageNavigatorProps {
    currentPage: number;
    totalPages: number;
    onChange: (page: number) => void;
}
function PageNavigator({ currentPage, totalPages, onChange }: PageNavigatorProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState(String(currentPage));

    // Sync input value when currentPage changes externally
    useEffect(() => {
        setInputValue(String(currentPage));
    }, [currentPage]);

    const handleSubmit = () => {
        const page = parseInt(inputValue, 10);
        if (!isNaN(page) && page >= 1 && page <= totalPages) {
            onChange(page);
        } else {
            // Reset to current page if invalid
            setInputValue(String(currentPage));
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSubmit();
            inputRef.current?.blur();
        } else if (e.key === 'Escape') {
            setInputValue(String(currentPage));
            inputRef.current?.blur();
        }
    };

    const handleBlur = () => {
        handleSubmit();
    };

    return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Page</span>
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="w-8 h-5 text-center text-xs px-1 py-0 bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
            <span>/ {totalPages}</span>
        </div>
    );
}

interface ZoomControlsProps {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitToView: () => void;
    canZoomIn: boolean;
    canZoomOut: boolean;
}
function ZoomControls({ zoom, onZoomIn, onZoomOut, onFitToView, canZoomIn, canZoomOut }: ZoomControlsProps) {
    return (
        <div className="flex items-center gap-x-0.5">
            <VTooltip description="Zoom out" placement="bottom" size="xs">
                <button
                    className={clsx(
                        "p-1 rounded cursor-pointer transition-colors",
                        canZoomOut
                            ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                            : "text-muted-foreground/40 cursor-not-allowed"
                    )}
                    onClick={onZoomOut}
                    disabled={!canZoomOut}
                >
                    <Minus className="size-4" />
                </button>
            </VTooltip>
            <span className="text-xs text-muted-foreground min-w-[32px] text-center">
                {zoom}%
            </span>
            <VTooltip description="Zoom in" placement="bottom" size="xs">
                <button
                    className={clsx(
                        "p-1 rounded cursor-pointer transition-colors",
                        canZoomIn
                            ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                            : "text-muted-foreground/40 cursor-not-allowed"
                    )}
                    onClick={onZoomIn}
                    disabled={!canZoomIn}
                >
                    <Plus className="size-4" />
                </button>
            </VTooltip>
            <VTooltip description="Fit to width" placement="bottom" size="xs">
                <button
                    className={clsx(
                        "p-1 rounded cursor-pointer transition-colors",
                        zoom !== DEFAULT_ZOOM
                            ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                            : "text-muted-foreground/40"
                    )}
                    onClick={onFitToView}
                >
                    <Maximize className="size-4" />
                </button>
            </VTooltip>
        </div>
    );
}