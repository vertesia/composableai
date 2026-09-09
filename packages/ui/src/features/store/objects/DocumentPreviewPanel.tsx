import { type ContentObject, ImageRenditionFormat } from '@vertesia/common';
import { Button, Spinner, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useNavigate } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { JSONDisplay, MarkdownRenderer } from '@vertesia/ui/widgets';
import { ChevronRight, Download, FileText, Info, LayoutGrid, Maximize2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface DocumentPreviewPanelProps {
    objectId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export function DocumentPreviewPanel({ objectId, isOpen, onClose }: DocumentPreviewPanelProps) {
    const navigate = useNavigate();
    const { client, store } = useUserSession();
    const [object, setObject] = useState<ContentObject | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState(false);
    const [text, setText] = useState<string | undefined>();
    const [imageUrl, setImageUrl] = useState<string | undefined>();
    const [currentTab, setCurrentTab] = useState('preview');
    const { t } = useUITranslation();
    const toast = useToast();

    const loadObjectText = useCallback(
        async (id: string) => {
            setLoadingText(true);
            try {
                const result = await store.objects.getObjectText(id);
                setText(result.text);
            } catch (error) {
                console.error('Error loading text:', error);
            } finally {
                setLoadingText(false);
            }
        },
        [store.objects],
    );

    const loadImageUrl = useCallback(
        async (obj: ContentObject) => {
            if (!obj.content?.source) {
                return;
            }

            try {
                // Try to get a rendition first
                const rendition = await client.objects.getRendition(obj.id, {
                    format: ImageRenditionFormat.jpeg,
                    generate_if_missing: false,
                });

                // Don't use rendition object to avoid type issues
                if (rendition.status === 'found') {
                    console.log('Found rendition');
                }

                // Get download URL
                const downloadUrlResult = await client.files.getDownloadUrl(obj.content.source);
                setImageUrl(downloadUrlResult.url);
            } catch (error) {
                console.error('Error loading image:', error);
            }
        },
        [client.files, client.objects],
    );

    useEffect(() => {
        if (objectId && isOpen) {
            setIsLoading(true);
            store.objects
                .retrieve(objectId, '+embeddings')
                .then((result) => {
                    setObject(result);
                    // If the object has text, use it
                    if (result.text) {
                        setText(result.text);
                    } else {
                        // Otherwise, fetch text
                        void loadObjectText(result.id);
                    }

                    // If it's an image, load the image URL
                    const content = result.content;
                    const isImage = content?.source && content.type?.startsWith('image/');
                    if (isImage) {
                        void loadImageUrl(result);
                    }
                })
                .catch((error) => {
                    console.error('Error loading object:', error);
                    toast({
                        title: t('agent.error'),
                        description: t('store.failedToLoadDocument'),
                        status: 'error',
                        duration: 3000,
                    });
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            // Reset state when panel closes
            setObject(null);
            setText(undefined);
            setImageUrl(undefined);
        }
    }, [objectId, isOpen, store.objects, loadObjectText, loadImageUrl, t, toast]);

    const handleViewFullDocument = () => {
        if (object) {
            navigate(`/legal/objects/${object.id}`);
            onClose();
        }
    };

    const seemsMarkdown = text && (text.startsWith('#') || text.includes('\n#') || text.includes('\n*'));
    const isImage = object?.content?.type?.startsWith('image/');
    const isPdf = object?.content?.type === 'application/pdf';

    if (!isOpen) return null;

    const panelTranslateClass = isOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'; // rtl-ok: mirrored inline-end transform

    return (
        <div
            className={`fixed inset-y-0 end-0 w-2/5 dark:bg-muted shadow-xl z-50 flex flex-col transition-transform duration-300 transform ${panelTranslateClass}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-border bg-gradient-to-r from-indigo-50 to-gray-50 dark:from-gray-800 dark:to-gray-900">
                <div className="flex items-center">
                    <FileText className="h-5 w-5 text-primary me-2" />
                    <h2 className="text-lg font-semibold text-foreground truncate">
                        {isLoading ? t('store.loadingDocument') : object?.name || t('store.documentPreview')}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleViewFullDocument}
                        className="flex items-center gap-1 text-primary hover:text-primary"
                    >
                        <Maximize2 className="h-4 w-4" />
                        <span>{t('store.fullView')}</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="flex items-center text-muted hover:text-foreground dark:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Spinner size="lg" className="text-primary mb-2" />
                        <p className="text-muted">{t('store.loadingDocument')}</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col h-full">
                    {/* Tabs */}
                    <div className="border-b">
                        <div className="flex px-4">
                            <Button
                                variant="unstyled"
                                className={`py-2 px-4 font-medium border-b-2 ${
                                    currentTab === 'preview'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted hover:text-foreground'
                                }`}
                                onClick={() => setCurrentTab('preview')}
                            >
                                <div className="flex items-center gap-1">
                                    <LayoutGrid className="h-4 w-4" />
                                    <span>{t('store.preview')}</span>
                                </div>
                            </Button>
                            <Button
                                variant="unstyled"
                                className={`py-2 px-4 font-medium border-b-2 ${
                                    currentTab === 'properties'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted hover:text-foreground'
                                }`}
                                onClick={() => setCurrentTab('properties')}
                            >
                                <div className="flex items-center gap-1">
                                    <Info className="h-4 w-4" />
                                    <span>{t('store.properties')}</span>
                                </div>
                            </Button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto p-4">
                        {currentTab === 'preview' && (
                            <div className="h-full">
                                {/* Text/Markdown Content */}
                                {loadingText ? (
                                    <div className="flex items-center justify-center h-40">
                                        <Spinner size="md" className="text-primary" />
                                    </div>
                                ) : text ? (
                                    <div className="shadow rounded-md p-4 border border-border bg-white dark:bg-muted">
                                        {seemsMarkdown ? (
                                            <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:bg-muted prose-pre:my-2 prose-headings:text-primary dark:prose-invert">
                                                <MarkdownRenderer>{text}</MarkdownRenderer>
                                            </div>
                                        ) : (
                                            <pre className="text-wrap whitespace-pre-wrap dark:text-foreground">
                                                {text}
                                            </pre>
                                        )}
                                    </div>
                                ) : null}

                                {/* Image Content */}
                                {isImage && (
                                    <div className="mt-4">
                                        {imageUrl ? (
                                            <div className="border border-border rounded-md p-2 bg-white dark:bg-muted">
                                                <img
                                                    src={imageUrl}
                                                    alt={object?.name}
                                                    className="mx-auto max-h-[70vh] object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center h-40">
                                                <Spinner size="md" className="text-primary" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* PDF Content Notice */}
                                {isPdf && (
                                    <div className="flex flex-col items-center justify-center h-64 border border-border rounded-md p-4 bg-muted">
                                        <FileText className="h-16 w-16 text-primary mb-4" />
                                        <p className="text-muted text-center mb-4">{t('store.pdfPreviewFullView')}</p>
                                        <Button
                                            onClick={handleViewFullDocument}
                                            className="bg-primary hover:bg-primary text-white"
                                        >
                                            {t('store.openFullDocumentView')}
                                        </Button>
                                    </div>
                                )}

                                {/* No Content Notice */}
                                {!isImage && !text && !isPdf && !loadingText && (
                                    <div className="flex flex-col items-center justify-center h-64 border border-border rounded-md p-4 bg-muted">
                                        <FileText className="h-16 w-16 text-foreground dark:text-muted mb-4" />
                                        <p className="text-muted text-center">{t('store.noPreviewAvailable')}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {currentTab === 'properties' && object && (
                            <div className="h-full">
                                {object.properties ? (
                                    <div className="shadow rounded-md p-4 border border-border bg-white dark:bg-muted">
                                        <JSONDisplay value={object.properties} />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 border border-border rounded-md p-4 bg-muted">
                                        <Info className="h-16 w-16 text-foreground dark:text-muted mb-4" />
                                        <p className="text-muted text-center">{t('store.noPropertiesAvailable')}</p>
                                    </div>
                                )}

                                <div className="mt-4">
                                    <h3 className="text-sm font-semibold text-foreground mb-2">
                                        {t('store.documentInformation')}
                                    </h3>
                                    <div className="shadow rounded-md p-4 border border-border bg-white dark:bg-muted">
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                                            <div className="text-muted">{t('store.id')}</div>
                                            <div className="font-medium dark:text-foreground">{object.id}</div>

                                            <div className="text-muted">{t('store.contentType')}</div>
                                            <div className="font-medium dark:text-foreground">
                                                {object.type?.name || t('store.unknown')}
                                            </div>

                                            <div className="text-muted">{t('store.contentType')}</div>
                                            <div className="font-medium dark:text-foreground">
                                                {object.content?.type || t('store.na')}
                                            </div>

                                            <div className="text-muted">{t('store.size')}</div>
                                            <div className="font-medium">
                                                {object.content && 'size' in object.content
                                                    ? formatFileSize(object.content.size as number)
                                                    : t('store.unknown')}
                                            </div>

                                            <div className="text-muted">{t('store.created')}</div>
                                            <div className="font-medium">
                                                {object.created_at
                                                    ? new Date(object.created_at).toLocaleString()
                                                    : t('store.na')}
                                            </div>

                                            <div className="text-muted">{t('store.updated')}</div>
                                            <div className="font-medium">
                                                {object.updated_at
                                                    ? new Date(object.updated_at).toLocaleString()
                                                    : t('store.na')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between p-4 border-t bg-muted dark:border-border">
                <div>
                    {object?.content?.source && (
                        <Button
                            onClick={() => {
                                if (object?.content?.source) {
                                    client.files
                                        .getDownloadUrl(object.content.source)
                                        .then((result) => {
                                            window.open(result.url, '_blank');
                                        })
                                        .catch((error) => {
                                            console.error('Error getting download URL:', error);
                                            toast({
                                                title: t('agent.error'),
                                                description: t('store.failedToDownloadFile'),
                                                status: 'error',
                                                duration: 3000,
                                            });
                                        });
                                }
                            }}
                            variant="outline"
                            className="text-primary border-primary hover:bg-info"
                        >
                            <Download className="h-4 w-4 me-2" />
                            {t('pdf.download')}
                        </Button>
                    )}
                </div>
                <Button onClick={handleViewFullDocument} className="bg-primary hover:bg-primary text-white">
                    {t('store.openFullDocument')}
                    <ChevronRight className="h-4 w-4 ms-2 cn-rtl-flip" />
                </Button>
            </div>
        </div>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
