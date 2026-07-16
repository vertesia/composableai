import type { ContentObject } from '@vertesia/common';
import {
    Button,
    ErrorBox,
    errorMessage,
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
    useFetch,
} from '@vertesia/ui/core';
import { i18nInstance, NAMESPACE, useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { X } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode, useState } from 'react';
import { PdfPageSlider } from '../pdf-viewer/PdfPageSlider';
import { DownloadPopover } from './DownloadPopover';
import { ExtractedContentView } from './ExtractedContentView';
import { MagicPdfProvider, useMagicPdfContext } from './MagicPdfProvider';

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
                        <ErrorBox title={i18nInstance.t('pdf.failedToLoadViewer', { ns: NAMESPACE })}>
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
    const { t } = useUITranslation();
    const { client } = useUserSession();

    const { data: object, error } = useFetch(() => client.store.objects.retrieve(objectId, '+text'), [objectId]);

    if (error) {
        return (
            <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 p-8 max-w-md">
                    <ErrorBox title={t('pdf.fetchingDocumentFailed')}>{errorMessage(error)}</ErrorBox>
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
            <div className="fixed inset-0 bg-background z-50 flex flex-col">
                {/* Header matching the main view layout */}
                <div className="flex h-9 items-center justify-end shrink-0 bg-sidebar px-2 border-b border-sidebar-border">
                    {onClose && (
                        <Button variant="ghost" size="xs" onClick={onClose} alt={t('pdf.close')}>
                            <X className="size-4" />
                        </Button>
                    )}
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            </div>
        );
    }

    return (
        <PdfViewErrorBoundary onClose={onClose}>
            <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
                <MagicPdfProvider object={object}>
                    <MagicPdfViewImpl object={object} onClose={onClose} />
                </MagicPdfProvider>
            </div>
        </PdfViewErrorBoundary>
    );
}

interface _MagicPdfViewProps {
    object: ContentObject;
    onClose?: () => void;
}
function MagicPdfViewImpl({ object, onClose }: _MagicPdfViewProps) {
    const { t } = useUITranslation();
    const { count: totalPages, pdfUrl, pdfUrlLoading } = useMagicPdfContext();
    const [pageNumber, setPageNumber] = useState(1);

    return (
        <ResizablePanelGroup direction="horizontal" className="absolute inset-0">
            <ResizablePanel defaultSize={50} minSize={20} maxSize={80} className="bg-muted">
                <PdfPageSlider
                    pdfUrl={pdfUrl}
                    pdfUrlLoading={pdfUrlLoading}
                    pageCount={totalPages}
                    className="h-full"
                    currentPage={pageNumber}
                    onChange={setPageNumber}
                />
            </ResizablePanel>
            <ResizableHandle className="w-[4px] bg-border cursor-ew-resize" />
            <ResizablePanel defaultSize={50} minSize={20} className="flex flex-col">
                {/* Header */}
                <div className="flex h-9 items-center justify-between shrink-0 bg-sidebar px-2 border-b border-sidebar-border">
                    <div className="flex items-center gap-x-2">
                        <DownloadPopover object={object} />
                    </div>
                    <span className="text-xs text-muted-foreground">{t('pdf.pageOf', { pageNumber, totalPages })}</span>
                    <div className="flex items-center gap-x-2">
                        {!!onClose && (
                            <Button variant="ghost" size="xs" onClick={onClose} alt={t('pdf.close')}>
                                <X className="size-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-auto px-2">
                    <ExtractedContentView pageNumber={pageNumber} viewType="markdown" />
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}
