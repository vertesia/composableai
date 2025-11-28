import { Button, Center } from "@vertesia/ui/core";
import clsx from "clsx";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { useRef, useEffect, useState, useCallback, KeyboardEvent } from "react";
import { usePdfPagesInfo } from "./PdfPageProvider";
import { PdfThumbnailList } from "./PdfPageRenderer";

// A4 portrait aspect ratio - used as fallback
const A4_ASPECT_RATIO = 210 / 297;

interface PageSliderProps {
    currentPage: number;
    onChange: (pageNumber: number) => void;
    className?: string;
    /** Compact mode reduces padding and navigation bar heights */
    compact?: boolean;
}
export function PageSlider({ className, currentPage, onChange, compact = false }: PageSliderProps) {
    const ref = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { pdfUrl, pdfUrlLoading, count } = usePdfPagesInfo();
    const [thumbnailWidth, setThumbnailWidth] = useState<number | undefined>(undefined);
    const [aspectRatio, setAspectRatio] = useState<number>(A4_ASPECT_RATIO);
    // Track the actual item height from PdfThumbnailList for accurate scroll calculations
    const [itemHeight, setItemHeight] = useState<number | null>(null);

    // Track the previous item height to preserve scroll position during resize
    const prevItemHeightRef = useRef<number | null>(null);

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
                setThumbnailWidth(newWidth);

                // Use requestAnimationFrame to scroll after the DOM updates
                requestAnimationFrame(() => {
                    container.scrollTo({ top: newScrollTop, behavior: 'instant' });
                });

                prevItemHeightRef.current = newItemHeight;
            } else {
                setThumbnailWidth(newWidth);
                prevItemHeightRef.current = getItemHeight(newWidth, aspectRatio);
            }
        };

        // Initial width update
        const initialWidth = getAvailableWidth();
        if (initialWidth > 0) {
            setThumbnailWidth(initialWidth);
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
                const clampedPage = Math.max(1, Math.min(calculatedPage, count));
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
    }, [itemHeight, count, currentPage, onChange]);

    const goPrev = () => {
        if (currentPage > 1) {
            onChange(currentPage - 1);
        }
    }
    const goNext = () => {
        if (currentPage < count) {
            onChange(currentPage + 1);
        }
    }

    return (
        <div ref={ref} className={clsx('flex flex-col items-stretch', compact ? 'gap-y-1' : 'gap-y-2', className)}>
            <div className={clsx("relative flex items-center justify-center px-2", compact ? "h-6" : "h-9")}>
                <Button variant="ghost" size="xs" onClick={goPrev} alt="Previous page">
                    <ChevronsUp className='size-4' />
                </Button>
                <div className="absolute right-2">
                    <PageNavigator currentPage={currentPage} totalPages={count} onChange={onChange} />
                </div>
            </div>
            <div ref={scrollContainerRef} className={clsx('flex flex-col items-center flex-1 overflow-y-auto px-2', compact ? 'gap-1' : 'gap-2')}>
                <PdfThumbnailList
                    pdfUrl={pdfUrl}
                    urlLoading={pdfUrlLoading}
                    pageCount={count}
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
