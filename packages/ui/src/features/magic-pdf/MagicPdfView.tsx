import { ContentObject, DocumentMetadata } from "@vertesia/common";
import { Button, ErrorBox, ResizableHandle, ResizablePanel, ResizablePanelGroup, useFetch } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { X } from "lucide-react";
import { Component, ErrorInfo, ReactNode, useState } from "react";
import { DownloadPopover } from "./DownloadPopover";
import { PageSlider } from "./PageSlider";
import { PdfPageProvider } from "./PdfPageProvider";
import { TextPageView } from "./TextPageView";
import { ViewType } from "./types";

// Error boundary for PDF view
interface ErrorBoundaryProps {
    children: ReactNode;
    onClose?: () => void;
}
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}
class PdfViewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('PDF View error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 p-8 max-w-md">
                        <ErrorBox title="Failed to load PDF viewer">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </ErrorBox>
                        {this.props.onClose && (
                            <Button variant="outline" onClick={this.props.onClose}>
                                Close
                            </Button>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

interface MagicPdfViewProps {
    objectId: string;
    onClose?: () => void;
}
export function MagicPdfView({ objectId, onClose }: MagicPdfViewProps) {
    const { client } = useUserSession();

    const { data: object, error } = useFetch(() => client.store.objects.retrieve(objectId, "+text"), [objectId]);

    if (error) {
        return (
            <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 p-8 max-w-md">
                    <ErrorBox title="Fetching document failed">{error.message}</ErrorBox>
                    {onClose && (
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    if (!object) {
        return (
            <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <PdfViewErrorBoundary onClose={onClose}>
            <div className='fixed inset-0 bg-background z-50 flex items-center justify-center'>
                <PdfPageProvider object={object}>
                    <MagicPdfViewImpl object={object} onClose={onClose} />
                </PdfPageProvider >
            </div>
        </PdfViewErrorBoundary>
    );
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

    return (
        <ResizablePanelGroup direction="horizontal" className="absolute inset-0">
            <ResizablePanel defaultSize={50} minSize={20} maxSize={80} className="bg-muted">
                <PageSlider className="h-full" currentPage={pageNumber} onChange={setPageNumber} />
            </ResizablePanel>
            <ResizableHandle className="w-[4px] bg-border cursor-ew-resize" />
            <ResizablePanel defaultSize={50} minSize={20} className="flex flex-col">
                {/* Header */}
                <div className="flex h-9 items-center justify-between shrink-0 bg-sidebar px-2 border-b border-sidebar-border">
                    <div className="flex items-center gap-x-2">
                        <DownloadPopover object={object} />
                    </div>
                    <div className="flex items-center gap-x-2">
                        {processorType === "xml" && <ContentSwitcher type={viewType} onSwitch={setViewType} />}
                        {!!onClose && (
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={onClose}
                                alt="Close"
                            >
                                <X className='size-4' />
                            </Button>
                        )}
                    </div>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-auto px-2">
                    <TextPageView pageNumber={pageNumber} viewType={viewType} />
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
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

    const getTitle = () => {
        if (type === "xml") return "Switch to JSON";
        if (type === "json") return "Switch to Markdown";
        return "Switch to XML";
    };

    return (
        <button
            className="w-5 h-5 cursor-pointer text-muted-foreground hover:text-foreground flex items-center justify-center"
            onClick={_onSwitch}
            title={getTitle()}
        >
            {type === "xml" && JSON}
            {type === "json" && MARKDOWN}
            {type === "markdown" && XML}
        </button>
    )
}

const JSON = <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M6 2.984V2h-.09c-.313 0-.616.062-.909.185a2.33 2.33 0 0 0-.775.53 2.23 2.23 0 0 0-.493.753v.001a3.542 3.542 0 0 0-.198.83v.002a6.08 6.08 0 0 0-.024.863c.012.29.018.58.018.869 0 .203-.04.393-.117.572v.001a1.504 1.504 0 0 1-.765.787 1.376 1.376 0 0 1-.558.115H2v.984h.09c.195 0 .38.04.556.121l.001.001c.178.078.329.184.455.318l.002.002c.13.13.233.285.307.465l.001.002c.078.18.117.368.117.566 0 .29-.006.58-.018.869-.012.296-.004.585.024.87v.001c.033.283.099.558.197.824v.001c.106.273.271.524.494.753.223.23.482.407.775.53.293.123.596.185.91.185H6v-.984h-.09c-.2 0-.387-.038-.563-.115a1.613 1.613 0 0 1-.457-.32 1.659 1.659 0 0 1-.309-.467c-.074-.18-.11-.37-.11-.573 0-.228.003-.453.011-.672.008-.228.008-.45 0-.665a4.639 4.639 0 0 0-.055-.64 2.682 2.682 0 0 0-.168-.609A2.284 2.284 0 0 0 3.522 8a2.284 2.284 0 0 0 .738-.955c.08-.192.135-.393.168-.602.033-.21.051-.423.055-.64.008-.22.008-.442 0-.666-.008-.224-.012-.45-.012-.678a1.47 1.47 0 0 1 .877-1.354 1.33 1.33 0 0 1 .563-.121H6zm4 10.032V14h.09c.313 0 .616-.062.909-.185.293-.123.552-.3.775-.53.223-.23.388-.48.493-.753v-.001c.1-.266.165-.543.198-.83v-.002c.028-.28.036-.567.024-.863-.012-.29-.018-.58-.018-.869 0-.203.04-.393.117-.572v-.001a1.502 1.502 0 0 1 .765-.787 1.38 1.38 0 0 1 .558-.115H14v-.984h-.09c-.196 0-.381-.04-.557-.121l-.001-.001a1.376 1.376 0 0 1-.455-.318l-.002-.002a1.415 1.415 0 0 1-.307-.465v-.002a1.405 1.405 0 0 1-.118-.566c0-.29.006-.58.018-.869a6.174 6.174 0 0 0-.024-.87v-.001a3.537 3.537 0 0 0-.197-.824v-.001a2.23 2.23 0 0 0-.494-.753 2.331 2.331 0 0 0-.775-.53 2.325 2.325 0 0 0-.91-.185H10v.984h.09c.2 0 .387.038.562.115.174.082.326.188.457.32.127.134.23.29.309.467.074.18.11.37.11.573 0 .228-.003.452-.011.672-.008.228-.008.45 0 .665.004.222.022.435.055.64.033.214.089.416.168.609a2.285 2.285 0 0 0 .738.955 2.285 2.285 0 0 0-.738.955 2.689 2.689 0 0 0-.168.602c-.033.21-.051.423-.055.64a9.15 9.15 0 0 0 0 .666c.008.224.012.45.012.678a1.471 1.471 0 0 1-.877 1.354 1.33 1.33 0 0 1-.563.121H10z" />
</svg>

const XML = <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M4.708 5.578L2.061 8.224l2.647 2.646-.708.708-3-3V7.87l3-3 .708.708zm7-.708L11 5.578l2.647 2.646L11 10.87l.708.708 3-3V7.87l-3-3zM4.908 13l.894.448 5-10L9.908 3l-5 10z" />
</svg>

const MARKDOWN = <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15v-7.7C16 3.52 15.48 3 14.85 3zM9 11H7.5L5.5 9l-1 1.5H3V5h1.5l1 2 2-2H9v6zm2.99.5L9.5 8H11V5h1v3h1.5l-2.51 3.5z"/>
</svg>
