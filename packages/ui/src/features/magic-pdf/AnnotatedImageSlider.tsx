import { Button, Center, VTooltip } from "@vertesia/ui/core";
import clsx from "clsx";
import { ChevronsDown, ChevronsUp, Image, Loader2, ScanSearch } from "lucide-react";
import { useRef, KeyboardEvent, useState, useEffect } from "react";
import { ImageType, useMagicPdfContext, PageImageProvider } from "./MagicPdfProvider";

interface AnnotatedImageSliderProps {
    currentPage: number;
    onChange: (pageNumber: number) => void;
    className?: string;
}

/**
 * Image-based page slider that displays annotated/instrumented page images.
 * Used for XML processor to show annotated images instead of PDF thumbnails.
 */
export function AnnotatedImageSlider({ className, currentPage, onChange }: AnnotatedImageSliderProps) {
    const [imageType, setImageType] = useState<ImageType>(ImageType.instrumented);
    const ref = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { imageProvider, count } = useMagicPdfContext();

    // Jump to current page when it changes
    const prevPageRef = useRef(currentPage);
    useEffect(() => {
        if (prevPageRef.current !== currentPage && scrollContainerRef.current) {
            prevPageRef.current = currentPage;
            const thumbnail = scrollContainerRef.current.querySelector(`[data-page="${currentPage}"]`);
            if (thumbnail) {
                thumbnail.scrollIntoView({
                    behavior: 'instant',
                    block: 'nearest',
                });
            }
        }
    }, [currentPage]);

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
                    <LazyPageThumbnail
                        key={index}
                        imageProvider={imageProvider}
                        imageType={imageType}
                        currentPage={currentPage}
                        pageNumber={index + 1}
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

interface LazyPageThumbnailProps {
    imageProvider: PageImageProvider;
    imageType: ImageType;
    pageNumber: number;
    currentPage: number;
    onSelect: () => void;
}
function LazyPageThumbnail({ imageProvider, imageType, pageNumber, currentPage, onSelect }: LazyPageThumbnailProps) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const isSelected = pageNumber === currentPage;

    useEffect(() => {
        setLoading(true);
        setError(false);
        imageProvider.getPageImageUrl(pageNumber, imageType)
            .then((imageUrl) => {
                setUrl(imageUrl);
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, [imageProvider, pageNumber, imageType]);

    return (
        <div
            className="p-2 hover:bg-muted rounded-md w-full"
            data-page={pageNumber}
        >
            <div
                className={clsx(
                    'relative border-[2px] cursor-pointer overflow-hidden min-h-[100px] flex items-center justify-center',
                    isSelected ? "border-primary" : "border-border"
                )}
                onClick={onSelect}
            >
                {loading && (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                )}
                {error && !loading && (
                    <span className="text-xs text-muted-foreground">Failed to load</span>
                )}
                {url && !loading && !error && (
                    <img src={url} alt={`Page ${pageNumber}`} className="w-full" />
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
