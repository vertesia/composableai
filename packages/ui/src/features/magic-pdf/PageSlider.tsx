import { Center } from "@vertesia/ui/core";
import clsx from "clsx";
import { AtSignIcon, ChevronsDown, ChevronsUp, ImageIcon, InfoIcon } from "lucide-react";
import { useRef, useState } from "react";
import { usePdfPagesInfo } from "./PdfPageProvider";

enum ImageType {
    default,
    instrumented,
    annotated,
}

interface PageSliderProps {
    currentPage: number;
    onChange: (pageNumber: number) => void;
    className?: string;
}
export function PageSlider({ className, currentPage, onChange }: PageSliderProps) {
    const [imageType, setImageType] = useState<ImageType>(ImageType.default);
    const ref = useRef<HTMLDivElement>(null);
    const { urls, annotatedUrls, instrumentedUrls } = usePdfPagesInfo();
    const goPrev = () => {
        if (currentPage > 1) {
            onChange(currentPage - 1);
            if (ref.current) {
                ref.current.querySelector(`div[data-index="${currentPage - 1}"]`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end',
                    inline: 'center'
                });
            }
        }
    }
    const goNext = () => {
        if (currentPage < urls.length) {
            onChange(currentPage + 1);
            if (ref.current) {
                ref.current.querySelector(`div[data-index="${currentPage + 1}"]`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end',
                    inline: 'center'
                });
            }
        }

    }

    const actualUrls = imageType === ImageType.instrumented ? instrumentedUrls :
        (imageType === ImageType.annotated ? annotatedUrls : urls);

    return (
        <div ref={ref} className={clsx('flex flex-col items-stretch gap-y-2', className)}>
            <div className="flex h-5 items-center justify-center relative">
                <button className={BTN_CLASS}
                    onClick={goPrev}>
                    <ChevronsUp className='w-5 h-5' />
                </button>
                <div className="absolute right-3 flex gap-x-1">
                    <button className={getRadioButtonClass(ImageType.default, imageType)}
                        onClick={() => setImageType(ImageType.default)}
                    ><ImageIcon className="w-5 h-5 mt-1" /></button>
                    <button className={getRadioButtonClass(ImageType.instrumented, imageType)}
                        onClick={() => setImageType(ImageType.instrumented)}
                    ><InfoIcon className="w-5 h-5 mt-1" /></button>
                    <button className={getRadioButtonClass(ImageType.annotated, imageType)}
                        onClick={() => setImageType(ImageType.annotated)}
                    ><AtSignIcon className="w-5 h-5 mt-1" /></button>
                </div>
            </div>
            <div className='flex flex-col items-center gap-2 flex-1 overflow-y-auto px-2'>
                {actualUrls.map((url, index) => <PageThumbnail key={index} url={url}
                    currentPage={currentPage} pageNumber={index + 1}
                    onSelect={() => onChange(index + 1)} />)}
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


const BTN_CLASS = "cursor-pointer text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-500 hover:font-semibold";

function getRadioButtonClass(type: ImageType, currentType: ImageType) {
    if (type === currentType) {
        return '${BTN_CLASS} text-pink-600';
    } else {
        return `${BTN_CLASS}`;
    }
}
