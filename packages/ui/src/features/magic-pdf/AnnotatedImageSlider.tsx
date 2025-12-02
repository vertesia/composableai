import { Button, Center } from "@vertesia/ui/core";
import clsx from "clsx";
import { AtSignIcon, ChevronsDown, ChevronsUp, ImageIcon, InfoIcon } from "lucide-react";
import { useRef, KeyboardEvent, useState, useEffect } from "react";
import { useMagicPdfContext } from "./MagicPdfProvider";

enum ImageType {
    default,
    original,
    instrumented,
    annotated,
}

interface AnnotatedImageSliderProps {
    currentPage: number;
    onChange: (pageNumber: number) => void;
    className?: string;
    /** Whether to show original/instrumented images (markdown processor) or default/instrumented/annotated (xml processor) */
    processorType: "xml" | "markdown";
}

/**
 * Image-based page slider that displays annotated/instrumented page images.
 * Used for XML processor to show annotated images instead of PDF thumbnails.
 */
export function AnnotatedImageSlider({ className, currentPage, onChange, processorType }: AnnotatedImageSliderProps) {
    const getDefaultImageType = (): ImageType => {
        return processorType === "markdown" ? ImageType.original : ImageType.default;
    };

    const [imageType, setImageType] = useState<ImageType>(getDefaultImageType());
    const ref = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { urls, originalUrls, annotatedUrls, instrumentedUrls, count } = useMagicPdfContext();

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

    const actualUrls = imageType === ImageType.instrumented ? instrumentedUrls :
        (imageType === ImageType.annotated ? annotatedUrls :
            (imageType === ImageType.original ? originalUrls : urls));

    return (
        <div ref={ref} className={clsx('flex flex-col items-stretch gap-y-2', className)}>
            <div className="relative flex items-center justify-center px-2 h-9">
                <Button variant="ghost" size="xs" onClick={goPrev} alt="Previous page">
                    <ChevronsUp className='size-4' />
                </Button>
                <div className="absolute right-2 flex gap-x-1">
                    {processorType === "markdown" ? (
                        <>
                            <ImageTypeButton
                                type={ImageType.original}
                                currentType={imageType}
                                onClick={() => setImageType(ImageType.original)}
                                icon={<ImageIcon className="size-4" />}
                                title="Original images"
                            />
                            <ImageTypeButton
                                type={ImageType.instrumented}
                                currentType={imageType}
                                onClick={() => setImageType(ImageType.instrumented)}
                                icon={<InfoIcon className="size-4" />}
                                title="Instrumented images"
                            />
                        </>
                    ) : (
                        <>
                            <ImageTypeButton
                                type={ImageType.default}
                                currentType={imageType}
                                onClick={() => setImageType(ImageType.default)}
                                icon={<ImageIcon className="size-4" />}
                                title="Default images"
                            />
                            <ImageTypeButton
                                type={ImageType.instrumented}
                                currentType={imageType}
                                onClick={() => setImageType(ImageType.instrumented)}
                                icon={<InfoIcon className="size-4" />}
                                title="Instrumented images"
                            />
                            <ImageTypeButton
                                type={ImageType.annotated}
                                currentType={imageType}
                                onClick={() => setImageType(ImageType.annotated)}
                                icon={<AtSignIcon className="size-4" />}
                                title="Annotated images"
                            />
                        </>
                    )}
                </div>
                <div className="absolute left-2">
                    <PageNavigator currentPage={currentPage} totalPages={count} onChange={onChange} />
                </div>
            </div>
            <div ref={scrollContainerRef} className='flex flex-col items-center gap-2 flex-1 overflow-y-auto px-2'>
                {actualUrls.map((url, index) => (
                    <PageThumbnail
                        key={index}
                        url={url}
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
    title: string;
}
function ImageTypeButton({ type, currentType, onClick, icon, title }: ImageTypeButtonProps) {
    const isSelected = type === currentType;
    return (
        <button
            className={clsx(
                "p-1 rounded cursor-pointer transition-colors",
                isSelected
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            onClick={onClick}
            title={title}
        >
            {icon}
        </button>
    );
}

interface PageThumbnailProps {
    url: string;
    pageNumber: number;
    currentPage: number;
    onSelect: () => void;
}
function PageThumbnail({ url, pageNumber, currentPage, onSelect }: PageThumbnailProps) {
    const isSelected = pageNumber === currentPage;
    return (
        <div
            className="p-2 hover:bg-muted rounded-md w-full"
            data-page={pageNumber}
        >
            <div
                className={clsx(
                    'relative border-[2px] cursor-pointer overflow-hidden',
                    isSelected ? "border-primary" : "border-border"
                )}
                onClick={onSelect}
            >
                <img src={url} alt={`Page ${pageNumber}`} className="w-full" />
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
