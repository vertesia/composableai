import { Button, Center, VTooltip } from "@vertesia/ui/core";
import clsx from "clsx";
import { ChevronsDown, ChevronsUp, Image, Loader2, ScanSearch } from "lucide-react";
import { useRef, KeyboardEvent, useState, useEffect } from "react";
import { ImageType, useMagicPdfContext } from "./MagicPdfProvider";

// Default aspect ratio (letter size) used before first image loads
const DEFAULT_ASPECT_RATIO = 11 / 8.5; // height / width

// Generate page order radiating outward from current page
// e.g., if current=5 and total=10: [5, 6, 4, 7, 3, 8, 2, 9, 1, 10]
function getPageLoadOrder(currentPage: number, totalPages: number): number[] {
    const order: number[] = [currentPage];
    let offset = 1;

    while (order.length < totalPages) {
        const next = currentPage + offset;
        const prev = currentPage - offset;

        if (next <= totalPages) order.push(next);
        if (prev >= 1) order.push(prev);

        offset++;
    }

    return order;
}

interface AnnotatedImageSliderProps {
    currentPage: number;
    onChange: (pageNumber: number) => void;
    className?: string;
}

/**
 * Image-based page slider that displays annotated/instrumented page images.
 * Progressively loads images starting from current page and radiating outward.
 * Loads first image immediately to determine aspect ratio for stable layout.
 */
export function AnnotatedImageSlider({ className, currentPage, onChange }: AnnotatedImageSliderProps) {
    const [imageType, setImageType] = useState<ImageType>(ImageType.instrumented);
    const [aspectRatio, setAspectRatio] = useState<number>(DEFAULT_ASPECT_RATIO);
    const [loadedUrls, setLoadedUrls] = useState<Map<number, string>>(new Map());
    const loadedPagesRef = useRef<Set<number>>(new Set());
    const ref = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isProgrammaticScrollRef = useRef(false);
    const { imageProvider, count } = useMagicPdfContext();

    // Load first image to determine aspect ratio
    useEffect(() => {
        imageProvider.getPageImageUrl(1, imageType)
            .then((url) => {
                const img = new window.Image();
                img.onload = () => {
                    if (img.width > 0 && img.height > 0) {
                        setAspectRatio(img.height / img.width);
                    }
                };
                img.src = url;
            })
            .catch(() => {
                // Keep default aspect ratio on error
            });
    }, [imageProvider, imageType]);

    // Progressive loading: load pages in parallel, prioritized from current page outward
    useEffect(() => {
        let cancelled = false;
        const loadOrder = getPageLoadOrder(currentPage, count);

        // Load all pages in parallel, but they're already prioritized by loadOrder
        // The imageProvider handles deduplication via its pending map
        const loadPage = async (page: number) => {
            if (cancelled || loadedPagesRef.current.has(page)) return;

            try {
                const url = await imageProvider.getPageImageUrl(page, imageType);
                if (!cancelled) {
                    loadedPagesRef.current.add(page);
                    setLoadedUrls(prev => new Map(prev).set(page, url));
                }
            } catch {
                // Skip failed pages
            }
        };

        // Start all loads in parallel - prioritized pages will update state first
        // since they're fetched first in the loadOrder
        loadOrder.forEach(page => loadPage(page));

        return () => {
            cancelled = true;
        };
    }, [currentPage, count, imageType, imageProvider]);

    // Reset loaded URLs when image type changes
    useEffect(() => {
        loadedPagesRef.current = new Set();
        setLoadedUrls(new Map());
    }, [imageType]);

    // Jump to current page when it changes (user navigation via buttons/input)
    const prevPageRef = useRef(currentPage);
    useEffect(() => {
        if (prevPageRef.current !== currentPage && scrollContainerRef.current) {
            prevPageRef.current = currentPage;

            // Mark as programmatic scroll to avoid triggering onChange
            isProgrammaticScrollRef.current = true;

            const thumbnail = scrollContainerRef.current.querySelector(`[data-page="${currentPage}"]`);
            if (thumbnail) {
                thumbnail.scrollIntoView({
                    behavior: 'instant',
                    block: 'nearest',
                });
            }

            // Reset after a short delay to allow scroll event to fire
            requestAnimationFrame(() => {
                isProgrammaticScrollRef.current = false;
            });
        }
    }, [currentPage]);

    // Update current page based on scroll position (when user scrolls manually)
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

        const handleScroll = () => {
            // Skip if this is a programmatic scroll
            if (isProgrammaticScrollRef.current) return;

            // Debounce scroll updates
            if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
            scrollDebounceTimer = setTimeout(() => {
                // Find the page element closest to the center of the viewport
                const containerRect = container.getBoundingClientRect();
                const containerCenter = containerRect.top + containerRect.height / 2;

                let closestPage = currentPage;
                let closestDistance = Infinity;

                for (let i = 1; i <= count; i++) {
                    const pageEl = container.querySelector(`[data-page="${i}"]`);
                    if (pageEl) {
                        const pageRect = pageEl.getBoundingClientRect();
                        const pageCenter = pageRect.top + pageRect.height / 2;
                        const distance = Math.abs(pageCenter - containerCenter);

                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestPage = i;
                        }
                    }
                }

                if (closestPage !== currentPage) {
                    prevPageRef.current = closestPage;
                    onChange(closestPage);
                }
            }, 50);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
            container.removeEventListener('scroll', handleScroll);
        };
    }, [count, currentPage, onChange]);

    const goPrev = () => {
        if (currentPage > 1) {
            onChange(currentPage - 1);
        }
    };

    const goNext = () => {
        if (currentPage < count) {
            onChange(currentPage + 1);
        }
    };

    return (
        <div ref={ref} className={clsx('flex flex-col items-stretch gap-y-2', className)}>
            <div className="relative flex items-center justify-center px-2 h-9">
                <Button variant="ghost" size="xs" onClick={goPrev} alt="Previous page">
                    <ChevronsUp className='size-4' />
                </Button>
                <div className="absolute left-2 flex gap-x-1">
                    <ImageTypeButton
                        type={ImageType.original}
                        currentType={imageType}
                        onClick={() => setImageType(ImageType.original)}
                        icon={<Image className="size-4" />}
                        tooltip="Original images"
                    />
                    <ImageTypeButton
                        type={ImageType.instrumented}
                        currentType={imageType}
                        onClick={() => setImageType(ImageType.instrumented)}
                        icon={<ScanSearch className="size-4" />}
                        tooltip="Instrumented images"
                    />
                </div>
                <div className="absolute right-2">
                    <PageNavigator currentPage={currentPage} totalPages={count} onChange={onChange} />
                </div>
            </div>
            <div ref={scrollContainerRef} className='flex flex-col items-center gap-2 flex-1 overflow-y-auto px-2'>
                {Array.from({ length: count }, (_, index) => (
                    <PageThumbnail
                        key={index}
                        currentPage={currentPage}
                        pageNumber={index + 1}
                        aspectRatio={aspectRatio}
                        url={loadedUrls.get(index + 1)}
                        onSelect={() => onChange(index + 1)}
                    />
                ))}
            </div>
            <div className="flex items-center justify-center h-9">
                <Button variant="ghost" size="xs" onClick={goNext} alt="Next page">
                    <ChevronsDown className='size-4' />
                </Button>
            </div>
        </div>
    );
}

interface ImageTypeButtonProps {
    type: ImageType;
    currentType: ImageType;
    onClick: () => void;
    icon: React.ReactNode;
    tooltip: string;
}
function ImageTypeButton({ type, currentType, onClick, icon, tooltip }: ImageTypeButtonProps) {
    const isSelected = type === currentType;
    return (
        <VTooltip description={tooltip} placement="bottom" size="xs">
            <button
                className={clsx(
                    "p-1 rounded cursor-pointer transition-colors",
                    isSelected
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                onClick={onClick}
            >
                {icon}
            </button>
        </VTooltip>
    );
}

interface PageThumbnailProps {
    pageNumber: number;
    currentPage: number;
    aspectRatio: number;
    url?: string;
    onSelect: () => void;
}
function PageThumbnail({ pageNumber, currentPage, aspectRatio, url, onSelect }: PageThumbnailProps) {
    const isSelected = pageNumber === currentPage;

    return (
        <div
            className="p-2 hover:bg-muted rounded-md w-full"
            data-page={pageNumber}
        >
            <div
                className={clsx(
                    'relative border-[2px] cursor-pointer overflow-hidden flex items-center justify-center bg-muted/50',
                    isSelected ? "border-primary" : "border-border"
                )}
                style={{ aspectRatio: `1 / ${aspectRatio}` }}
                onClick={onSelect}
            >
                {url ? (
                    <img src={url} alt={`Page ${pageNumber}`} className="w-full" />
                ) : (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                )}
            </div>
            <Center className="text-sm text-muted-foreground pt-1 font-semibold">{pageNumber}</Center>
        </div>
    );
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
