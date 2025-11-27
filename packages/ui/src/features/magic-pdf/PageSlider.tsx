import { DocumentMetadata } from "@vertesia/common";
import { Center } from "@vertesia/ui/core";
import clsx from "clsx";
import { AtSignIcon, ChevronsDown, ChevronsUp, FileTextIcon, ImageIcon, InfoIcon } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { usePdfPagesInfo } from "./PdfPageProvider";
import { SharedPdfProvider, VirtualizedPdfPage } from "./PdfPageRenderer";

enum ImageType {
    default,
    original,
    instrumented,
    annotated,
    pdf, // New: render directly from PDF
}

interface PageSliderProps {
    currentPage: number;
    onChange: (pageNumber: number) => void;
    className?: string;
    object: any; // ContentObject type
}
export function PageSlider({ className, currentPage, onChange, object }: PageSliderProps) {
    const getProcessorType = (): string => {
        if (object.metadata?.type === "document") {
            const docMetadata = object.metadata as DocumentMetadata;
            return docMetadata.content_processor?.type || "xml";
        }
        return "xml"; // default
    };

    const getDefaultImageType = (): ImageType => {
        const processorType = getProcessorType();
        // For markdown processor, default to PDF rendering
        return processorType === "markdown" ? ImageType.pdf : ImageType.default;
    };

    const [imageType, setImageType] = useState<ImageType>(getDefaultImageType());
    const ref = useRef<HTMLDivElement>(null);
    const { urls, originalUrls, annotatedUrls, instrumentedUrls, pdfUrl, pdfUrlLoading, count } = usePdfPagesInfo();
    const isMarkdownProcessor = getProcessorType() === "markdown";

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

    const actualUrls = imageType === ImageType.instrumented ? instrumentedUrls :
        (imageType === ImageType.annotated ? annotatedUrls :
        (imageType === ImageType.original ? originalUrls : urls));

    const usePdfRendering = imageType === ImageType.pdf && (pdfUrl || pdfUrlLoading);

    return (
        <div ref={ref} className={clsx('flex flex-col items-stretch gap-y-2', className)}>
            <div className="flex h-5 items-center justify-center relative">
                <button className={BTN_CLASS}
                    onClick={goPrev}>
                    <ChevronsUp className='w-5 h-5' />
                </button>
                <div className="absolute right-3 flex gap-x-1">
                    {isMarkdownProcessor ? (
                        // For markdown processor, only show PDF button (no images available)
                        pdfUrl && (
                            <button className={getRadioButtonClass(ImageType.pdf, imageType)}
                                onClick={() => setImageType(ImageType.pdf)}
                                title="Render PDF directly"
                            ><FileTextIcon className="w-5 h-5 mt-1" /></button>
                        )
                    ) : (
                        <>
                            <button className={getRadioButtonClass(ImageType.default, imageType)}
                                onClick={() => setImageType(ImageType.default)}
                                title="Default images"
                            ><ImageIcon className="w-5 h-5 mt-1" /></button>
                            <button className={getRadioButtonClass(ImageType.instrumented, imageType)}
                                onClick={() => setImageType(ImageType.instrumented)}
                                title="Instrumented images"
                            ><InfoIcon className="w-5 h-5 mt-1" /></button>
                            <button className={getRadioButtonClass(ImageType.annotated, imageType)}
                                onClick={() => setImageType(ImageType.annotated)}
                                title="Annotated images"
                            ><AtSignIcon className="w-5 h-5 mt-1" /></button>
                            {pdfUrl && (
                                <button className={getRadioButtonClass(ImageType.pdf, imageType)}
                                    onClick={() => setImageType(ImageType.pdf)}
                                    title="Render PDF directly"
                                ><FileTextIcon className="w-5 h-5 mt-1" /></button>
                            )}
                        </>
                    )}
                </div>
            </div>
            <div className='flex flex-col items-center gap-2 flex-1 overflow-y-auto px-2'>
                {usePdfRendering ? (
                    // Render pages directly from PDF using shared provider
                    <SharedPdfProvider pdfUrl={pdfUrl} urlLoading={pdfUrlLoading}>
                        {Array.from({ length: count }, (_, index) => (
                            <PdfPageThumbnail
                                key={index}
                                currentPage={currentPage}
                                pageNumber={index + 1}
                                onSelect={() => onChange(index + 1)}
                            />
                        ))}
                    </SharedPdfProvider>
                ) : (
                    // Render from stored images
                    actualUrls.map((url, index) => (
                        <PageThumbnail
                            key={index}
                            url={url}
                            currentPage={currentPage}
                            pageNumber={index + 1}
                            onSelect={() => onChange(index + 1)}
                        />
                    ))
                )}
            </div>
            <div className="flex h-5 items-center justify-center relative">
                <button className={BTN_CLASS}
                    onClick={goNext}>
                    <ChevronsDown className='size-5' />
                </button>
            </div>
        </div>
    )
}

interface PageThumbnailProps {
    url: string,
    pageNumber: number;
    currentPage: number;
    onSelect: () => void;
}
function PageThumbnail({ url, pageNumber, currentPage, onSelect }: PageThumbnailProps) {
    return (
        <div className="p-2 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md" data-index={pageNumber - 1}>
            <div className={clsx('relative border-[2px] cursor-pointer', pageNumber === currentPage ? "border-blue-500 dark:border-pink-400" : "border-gray-300")}
                onClick={onSelect}>
                <img src={url} alt={`Page ${pageNumber}`} />
            </div >
            <Center className="text-sm text-gray-500 dark:text-gray-400 pt-1 font-semibold align">{pageNumber}</Center>
        </div>
    )
}

interface PdfPageThumbnailProps {
    pageNumber: number;
    currentPage: number;
    onSelect: () => void;
}
function PdfPageThumbnail({ pageNumber, currentPage, onSelect }: PdfPageThumbnailProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState<number | undefined>(undefined);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateWidth = () => {
            // Account for padding (p-2 = 8px on each side) and border (2px on each side)
            const availableWidth = container.clientWidth - 4; // 2px border on each side
            setWidth(availableWidth > 0 ? availableWidth : undefined);
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(updateWidth);
        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, []);

    return (
        <div className="p-2 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md w-full" data-index={pageNumber - 1}>
            <div
                ref={containerRef}
                className={clsx('relative border-[2px] cursor-pointer overflow-hidden', pageNumber === currentPage ? "border-blue-500 dark:border-pink-400" : "border-gray-300")}
                onClick={onSelect}
            >
                <VirtualizedPdfPage
                    pageNumber={pageNumber}
                    width={width}
                    rootMargin="100px 0px"
                />
            </div>
            <Center className="text-sm text-gray-500 dark:text-gray-400 pt-1 font-semibold align">{pageNumber}</Center>
        </div>
    )
}


const BTN_CLASS = "cursor-pointer text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-500 hover:font-semibold";

function getRadioButtonClass(type: ImageType, currentType: ImageType) {
    if (type === currentType) {
        return `${BTN_CLASS} text-pink-600`;
    } else {
        return `${BTN_CLASS}`;
    }
}
