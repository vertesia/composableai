import { ContentObject, DocumentMetadata } from "@vertesia/common";
import { ErrorBox, useFetch } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { DownloadPopover } from "./DownloadPopover";
import { PageSlider } from "./PageSlider";
import { PdfPageProvider } from "./PdfPageProvider";
import { TextPageView } from "./TextPageView";
import { ViewType } from "./types";
import { useResizeEW } from "./useResizeOnDrag";


interface MagicPdfViewProps {
    objectId: string;
    onClose?: () => void;
}
export function MagicPdfView({ objectId, onClose }: MagicPdfViewProps) {
    const { client } = useUserSession();

    const { data: object, error } = useFetch(() => client.store.objects.retrieve(objectId, "+text"), [objectId]);

    if (error) {
        return <ErrorBox title='Fetching document failed'>{error.message}</ErrorBox>
    }

    return object ? (
        <div className='fixed inset-0 bg-white dark:bg-slate-700 z-50 flex items-center justify-center'>
            <PdfPageProvider object={object}>
                <MagicPdfViewImpl object={object} onClose={onClose} />
            </PdfPageProvider >
        </div>
    ) : "Loading..."

}

interface _MagicPdfViewProps {
    object: ContentObject;
    onClose?: () => void;
}
function MagicPdfViewImpl({ object, onClose }: _MagicPdfViewProps) {
    const getInitialViewType = (): ViewType => {
        if (object.metadata?.type === "document") {
            const docMetadata = object.metadata as DocumentMetadata;
            const processorType = docMetadata.content_processor?.type;
            if (processorType === "markdown") return "markdown";
            if (processorType === "xml") return "xml";
        }
        return "xml"; // default
    };
    
    const getProcessorType = (): string => {
        if (object.metadata?.type === "document") {
            const docMetadata = object.metadata as DocumentMetadata;
            return docMetadata.content_processor?.type || "xml";
        }
        return "xml"; // default
    };
    
    const [viewType, setViewType] = useState<ViewType>(getInitialViewType());
    const [pageNumber, setPageNumber] = useState(1);
    const processorType = getProcessorType();
    const handler = useRef<HTMLDivElement>(null);
    const left = useRef<HTMLDivElement>(null);
    const right = useRef<HTMLDivElement>(null);

    useResizeEW({
        handler, left, right
    });
    return (
        <>
            <div ref={left} className={`absolute top-0 left-0 bottom-0 w-[50%] bg-gray-100 dark:bg-slate-800 flex items-stretch justify-stretch py-2`}>
                <PageSlider className="flex-1" currentPage={pageNumber} onChange={setPageNumber} object={object} />
                <div ref={handler} className='w-[2px] p-[2px] m-0 bg-slate-300 cursor-ew-resize'></div>
            </div>
            <div ref={right} className={`absolute top-0 left-[50%] right-0 bottom-0 flex items-stretch justify-stretch overflow-auto p-2`}>
                <TextPageView pageNumber={pageNumber} viewType={viewType} />
            </div>
            <DownloadPopover object={object} />
            {processorType === "xml" && <ContentSwitcher type={viewType} onSwitch={setViewType} />}
            {!!onClose &&
                <div className="absolute top-6 right-7 w-9 h-9 cursor-pointer text-red-400 border-red-400 hover:border-red-500 hover:text-red-500 border-2 rounded-full shadow-xs flex items-center justify-center"
                    onClick={onClose}>
                    <X className='size-6' />
                </div>
            }
        </>
    )
}



interface ContentSwitcherProps {
    type?: ViewType;
    onSwitch: (type: ViewType) => void;
}
function ContentSwitcher({ type = "xml", onSwitch }: ContentSwitcherProps) {
    const _onSwitch = () => {
        if (type === "xml") {
            onSwitch("json");
        } else if (type === "json") {
            onSwitch("markdown");
        } else if (type === "markdown") {
            onSwitch("xml");
        }
    }
    return (
        <div className="absolute bottom-[16px] right-[20px] w-[36px] h-[36px] cursor-pointer text-indigo-400 border-indigo-400 hover:border-indigo-500 hover:text-indigo-500 border-2 rounded-full shadow-xs flex items-center justify-center"
            onClick={_onSwitch}>
            {type === "xml" && JSON}
            {type === "json" && MARKDOWN}
            {type === "markdown" && XML}
        </div>
    )

}

const JSON = <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M6 2.984V2h-.09c-.313 0-.616.062-.909.185a2.33 2.33 0 0 0-.775.53 2.23 2.23 0 0 0-.493.753v.001a3.542 3.542 0 0 0-.198.83v.002a6.08 6.08 0 0 0-.024.863c.012.29.018.58.018.869 0 .203-.04.393-.117.572v.001a1.504 1.504 0 0 1-.765.787 1.376 1.376 0 0 1-.558.115H2v.984h.09c.195 0 .38.04.556.121l.001.001c.178.078.329.184.455.318l.002.002c.13.13.233.285.307.465l.001.002c.078.18.117.368.117.566 0 .29-.006.58-.018.869-.012.296-.004.585.024.87v.001c.033.283.099.558.197.824v.001c.106.273.271.524.494.753.223.23.482.407.775.53.293.123.596.185.91.185H6v-.984h-.09c-.2 0-.387-.038-.563-.115a1.613 1.613 0 0 1-.457-.32 1.659 1.659 0 0 1-.309-.467c-.074-.18-.11-.37-.11-.573 0-.228.003-.453.011-.672.008-.228.008-.45 0-.665a4.639 4.639 0 0 0-.055-.64 2.682 2.682 0 0 0-.168-.609A2.284 2.284 0 0 0 3.522 8a2.284 2.284 0 0 0 .738-.955c.08-.192.135-.393.168-.602.033-.21.051-.423.055-.64.008-.22.008-.442 0-.666-.008-.224-.012-.45-.012-.678a1.47 1.47 0 0 1 .877-1.354 1.33 1.33 0 0 1 .563-.121H6zm4 10.032V14h.09c.313 0 .616-.062.909-.185.293-.123.552-.3.775-.53.223-.23.388-.48.493-.753v-.001c.1-.266.165-.543.198-.83v-.002c.028-.28.036-.567.024-.863-.012-.29-.018-.58-.018-.869 0-.203.04-.393.117-.572v-.001a1.502 1.502 0 0 1 .765-.787 1.38 1.38 0 0 1 .558-.115H14v-.984h-.09c-.196 0-.381-.04-.557-.121l-.001-.001a1.376 1.376 0 0 1-.455-.318l-.002-.002a1.415 1.415 0 0 1-.307-.465v-.002a1.405 1.405 0 0 1-.118-.566c0-.29.006-.58.018-.869a6.174 6.174 0 0 0-.024-.87v-.001a3.537 3.537 0 0 0-.197-.824v-.001a2.23 2.23 0 0 0-.494-.753 2.331 2.331 0 0 0-.775-.53 2.325 2.325 0 0 0-.91-.185H10v.984h.09c.2 0 .387.038.562.115.174.082.326.188.457.32.127.134.23.29.309.467.074.18.11.37.11.573 0 .228-.003.452-.011.672-.008.228-.008.45 0 .665.004.222.022.435.055.64.033.214.089.416.168.609a2.285 2.285 0 0 0 .738.955 2.285 2.285 0 0 0-.738.955 2.689 2.689 0 0 0-.168.602c-.033.21-.051.423-.055.64a9.15 9.15 0 0 0 0 .666c.008.224.012.45.012.678a1.471 1.471 0 0 1-.877 1.354 1.33 1.33 0 0 1-.563.121H10z" />
</svg>

const XML = <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M4.708 5.578L2.061 8.224l2.647 2.646-.708.708-3-3V7.87l3-3 .708.708zm7-.708L11 5.578l2.647 2.646L11 10.87l.708.708 3-3V7.87l-3-3zM4.908 13l.894.448 5-10L9.908 3l-5 10z" />
</svg>

const MARKDOWN = <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15v-7.7C16 3.52 15.48 3 14.85 3zM9 11H7.5L5.5 9l-1 1.5H3V5h1.5l1 2 2-2H9v6zm2.99.5L9.5 8H11V5h1v3h1.5l-2.51 3.5z"/>
</svg>
