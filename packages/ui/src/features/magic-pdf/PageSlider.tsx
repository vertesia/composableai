import { Center } from "@vertesia/ui/core";
import clsx from "clsx";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { usePdfPagesInfo } from "./PdfPageProvider";
import { SharedPdfProvider, VirtualizedPdfPage } from "./PdfPageRenderer";

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

    const goPrev = () => {
        if (currentPage > 1) {
            onChange(currentPage - 1);
            if (ref.current) {
                ref.current.querySelector(`div[data-index="${currentPage - 2}"]`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'center'
                });
            }
        }
    }
    const goNext = () => {
        if (currentPage < count) {
            onChange(currentPage + 1);
            if (ref.current) {
                ref.current.querySelector(`div[data-index="${currentPage}"]`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'center'
                });
            }
        }
    }

    return (
        <div ref={ref} className={clsx('flex flex-col items-stretch gap-y-2', className)}>
            <div className="flex h-5 items-center justify-center">
                <button className={BTN_CLASS}
                    onClick={goPrev}>
                    <ChevronsUp className='w-5 h-5' />
                </button>
            </div>
            <div ref={scrollContainerRef} className='flex flex-col items-center gap-2 flex-1 overflow-y-auto px-2'>
                <SharedPdfProvider pdfUrl={pdfUrl} urlLoading={pdfUrlLoading}>
                    {Array.from({ length: count }, (_, index) => (
                        <PdfPageThumbnail
                            key={index}
                            currentPage={currentPage}
                            pageNumber={index + 1}
                            width={thumbnailWidth}
                            onSelect={() => onChange(index + 1)}
                        />
                    ))}
                </SharedPdfProvider>
            </div>
            <div className="flex h-5 items-center justify-center">
                <button className={BTN_CLASS}
                    onClick={goNext}>
                    <ChevronsDown className='size-5' />
                </button>
            </div>
        </div>
    )
}

interface PdfPageThumbnailProps {
    pageNumber: number;
    currentPage: number;
    width?: number;
    onSelect: () => void;
}
function PdfPageThumbnail({ pageNumber, currentPage, width, onSelect }: PdfPageThumbnailProps) {
    return (
        <div className="p-2 hover:bg-muted rounded-md w-full" data-index={pageNumber - 1}>
            <div
                className={clsx('relative border-[2px] cursor-pointer overflow-hidden', pageNumber === currentPage ? "border-primary" : "border-border")}
                onClick={onSelect}
            >
                <VirtualizedPdfPage
                    pageNumber={pageNumber}
                    width={width}
                    rootMargin="100px 0px"
                />
            </div>
            <Center className="text-sm text-muted-foreground pt-1 font-semibold">{pageNumber}</Center>
        </div>
    )
}

const BTN_CLASS = "cursor-pointer text-muted-foreground hover:text-primary hover:font-semibold";
