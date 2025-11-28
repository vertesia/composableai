import { Button, Center } from "@vertesia/ui/core";
import clsx from "clsx";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { usePdfPagesInfo } from "./PdfPageProvider";
import { PdfThumbnailList } from "./PdfPageRenderer";

// A4 portrait aspect ratio - used as fallback
const A4_ASPECT_RATIO = 210 / 297;

interface PageSliderProps {
    currentPage: number;
    onChange: (pageNumber: number) => void;
    className?: string;
}
export function PageSlider({ className, currentPage, onChange }: PageSliderProps) {
    const ref = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { pdfUrl, pdfUrlLoading, count } = usePdfPagesInfo();
    const [thumbnailWidth, setThumbnailWidth] = useState<number | undefined>(undefined);
    const [aspectRatio, setAspectRatio] = useState<number>(A4_ASPECT_RATIO);

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
            const availableWidth = getAvailableWidth();
            setThumbnailWidth(availableWidth > 0 ? availableWidth : undefined);
        };

        // Initial width update
        updateWidth();

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
    }, []);

    // Jump to current page when it changes
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Calculate item height based on thumbnail width (matching PdfThumbnailList calculation)
        const placeholderHeight = thumbnailWidth ? Math.round(thumbnailWidth / aspectRatio) : 200;
        const itemHeight = placeholderHeight + 16 + 24 + 8; // padding + text + gap

        // Scroll to the page position
        const targetScrollTop = (currentPage - 1) * itemHeight;
        container.scrollTo({
            top: targetScrollTop,
            behavior: 'instant'
        });
    }, [currentPage, thumbnailWidth, aspectRatio]);

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
        <div ref={ref} className={clsx('flex flex-col items-stretch gap-y-2', className)}>
            <div className="relative flex h-9 items-center justify-center px-2">
                <Button variant="ghost" size="xs" onClick={goPrev} alt="Previous page">
                    <ChevronsUp className='size-4' />
                </Button>
                <div className="absolute right-2">
                    <PageNavigator currentPage={currentPage} totalPages={count} onChange={onChange} />
                </div>
            </div>
            <div ref={scrollContainerRef} className='flex flex-col items-center gap-2 flex-1 overflow-y-auto px-2'>
                <PdfThumbnailList
                    pdfUrl={pdfUrl}
                    urlLoading={pdfUrlLoading}
                    pageCount={count}
                    currentPage={currentPage}
                    thumbnailWidth={thumbnailWidth}
                    onPageSelect={onChange}
                    scrollContainerRef={scrollContainerRef}
                    onAspectRatioChange={setAspectRatio}
                    renderThumbnail={({ pageNumber, isSelected, pageElement, onSelect }) => (
                        <div key={pageNumber} className="p-2 hover:bg-muted rounded-md w-full" data-index={pageNumber - 1}>
                            <div
                                className={clsx('relative border-[2px] cursor-pointer overflow-hidden', isSelected ? "border-primary" : "border-border")}
                                onClick={onSelect}
                            >
                                {pageElement}
                            </div>
                            <Center className="text-sm text-muted-foreground pt-1 font-semibold">{pageNumber}</Center>
                        </div>
                    )}
                />
            </div>
            <div className="flex h-9 items-center justify-center">
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

