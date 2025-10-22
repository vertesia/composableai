import { useEffect, useState } from "react";

import { useUserSession } from "@vertesia/ui/session";
import { Button, ResizableHandle, ResizablePanel, ResizablePanelGroup, Spinner, useToast } from "@vertesia/ui/core";
import { JSONDisplay, MarkdownRenderer } from "@vertesia/ui/widgets";
import { ContentNature, ContentObject, ImageRenditionFormat, VideoMetadata, POSTER_RENDITION_NAME } from "@vertesia/common";
import { Copy, Download, SquarePen } from "lucide-react";
import { PropertiesEditorModal } from "./PropertiesEditorModal";
import { NavLink } from "@vertesia/ui/router";

enum PanelView {
    Text = "text",
    Image = "image",
    Video = "video"
}

interface ContentOverviewProps {
    object: ContentObject;
    loadText?: boolean;
    refetch?: () => Promise<unknown>;
}
export function ContentOverview({
    object,
    loadText,
    refetch,
}: ContentOverviewProps) {
    const toast = useToast();

    const handleCopyContent = async (
        content: string,
        type: "text" | "properties",
    ) => {
        try {
            await navigator.clipboard.writeText(content);
            toast({
                status: "success",
                title: `${type === "text" ? "Content" : "Properties"} copied`,
                description: `Successfully copied ${type} to clipboard`,
                duration: 2000,
            });
        } catch (err) {
            console.error(`Failed to copy ${type}:`, err);
            toast({
                status: "error",
                title: "Copy failed",
                description: `Failed to copy ${type} to clipboard`,
                duration: 5000,
            });
        }
    };

    return (
        <>
            <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-200px)]">
                <ResizablePanel className="min-w-[100px]">
                    <PropertiesPanel object={object} refetch={refetch ?? (() => Promise.resolve())} handleCopyContent={handleCopyContent} />
                </ResizablePanel>
                <ResizableHandle withHandle />

                <ResizablePanel className="min-w-[100px]">
                    <DataPanel object={object} loadText={loadText ?? false} handleCopyContent={handleCopyContent} />
                </ResizablePanel>
            </ResizablePanelGroup>

        </>
    );
}

function PropertiesPanel({ object, refetch, handleCopyContent }: { object: ContentObject, refetch: () => Promise<unknown>, handleCopyContent: (content: string, type: "text" | "properties") => Promise<void> }) {
    const [viewCode, setViewCode] = useState(false);
    const [isPropertiesModalOpen, setPropertiesModalOpen] = useState(false);

    const handleOpenPropertiesModal = () => {
        setPropertiesModalOpen(true);
    };

    const handleClosePropertiesModal = () => {
        setPropertiesModalOpen(false);
    };

    return (
        <>
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-1 bg-muted mb-2 p-1 rounded">
                    <Button
                        variant={`${viewCode ? "ghost" : "primary"}`}
                        size="sm"
                        alt="Preview properties"
                        onClick={() => setViewCode(!viewCode)}
                    >
                        Properties
                    </Button>
                    <Button
                        variant={`${viewCode ? "primary" : "ghost"}`}
                        size="sm"
                        alt="View in JSON format"
                        onClick={() => setViewCode(!viewCode)}
                    >
                        JSON
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    {object.properties && (
                        <Button
                            variant="ghost"
                            size="sm"
                            title="Copy properties"
                            onClick={() =>
                                handleCopyContent(
                                    JSON.stringify(
                                        object.properties,
                                        null,
                                        2,
                                    ),
                                    "properties",
                                )
                            }
                        >
                            <Copy className="size-4" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenPropertiesModal}
                        title="Edit properties"
                        className="flex items-center gap-2"
                    >
                        <SquarePen className="size-4" />
                    </Button>
                </div>
            </div>

            {
                object.properties ? (
                    <div className="h-[calc(100vh-220px)] overflow-auto px-2">
                        <JSONDisplay
                            value={object.properties}
                            viewCode={viewCode}

                        />
                    </div>
                ) : (
                    <div className="h-[calc(100vh-220px)] overflow-auto px-2">
                        <div>No properties defined</div>
                    </div>
                )
            }
            {/* Properties Editor Modal */}
            <PropertiesEditorModal
                isOpen={isPropertiesModalOpen}
                onClose={handleClosePropertiesModal}
                object={object}
                refetch={refetch}
            />
        </>
    );
}

function DataPanel({ object, loadText, handleCopyContent }: { object: ContentObject, loadText: boolean, handleCopyContent: (content: string, type: "text" | "properties") => Promise<void> }) {
    const { store } = useUserSession();

    const isImage = object?.metadata?.type === ContentNature.Image;
    const isVideo = object?.metadata?.type === ContentNature.Video;

    // Determine initial panel view
    const getInitialView = (): PanelView => {
        if (isVideo) return PanelView.Video;
        if (isImage) return PanelView.Image;
        return PanelView.Text;
    };

    const [currentPanel, setCurrentPanel] = useState<PanelView>(getInitialView());

    const [text, setText] = useState<string | undefined>(object.text);
    const [isLoadingText, setIsLoadingText] = useState<boolean>(false);

    useEffect(() => {
        if (loadText && !text) {
            setIsLoadingText(true);
            store.objects
                .getObjectText(object.id)
                .then((res) => {
                    setText(res.text);
                })
                .catch((err) => {
                    console.error("Failed to load text", err);
                })
                .finally(() => {
                    setIsLoadingText(false);
                });
        }
    }, [loadText]);

    return (
        <>
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-1 bg-muted mb-2 p-1 rounded">
                    {isImage &&
                        <Button
                            variant={currentPanel === PanelView.Image ? "primary" : "ghost"}
                            size="sm"
                            alt="View Image"
                            onClick={() => setCurrentPanel(PanelView.Image)}
                        >
                            Image
                        </Button>
                    }
                    {isVideo &&
                        <Button
                            variant={currentPanel === PanelView.Video ? "primary" : "ghost"}
                            size="sm"
                            alt="View Video"
                            onClick={() => setCurrentPanel(PanelView.Video)}
                        >
                            Video
                        </Button>
                    }
                    <Button
                        variant={currentPanel === PanelView.Text ? "primary" : "ghost"}
                        size="sm"
                        alt="View Text"
                        onClick={() => setCurrentPanel(PanelView.Text)}
                    >
                        Text
                    </Button>

                </div>
                {currentPanel === PanelView.Text && <TextActions object={object} text={text} handleCopyContent={handleCopyContent} />}
            </div>
            {
                currentPanel === PanelView.Image ? (
                    <ImagePanel object={object} />
                ) : currentPanel === PanelView.Video ? (
                    <VideoPanel object={object} />
                ) : (
                    isLoadingText ? (
                        <div className="flex justify-center items-center h-[calc(100vh-260px)]">
                            <Spinner size="lg" />
                        </div>
                    ) : (
                        <TextPanel object={object} text={text} />
                    )
                )
            }
        </>
    );
}

function TextActions({ object, text, handleCopyContent }: { object: ContentObject, handleCopyContent: (content: string, type: "text" | "properties") => Promise<void>, text: string | undefined }) {
    const { client } = useUserSession();
    const toast = useToast();
    const [loadingFormat, setLoadingFormat] = useState<"docx" | "pdf" | null>(null);

    const content = object.content;

    const isMarkdown =
        content &&
        content.type &&
        content.type === "text/markdown";

    const handleExportDocument = async (format: "docx" | "pdf") => {
        // Prevent multiple concurrent exports
        if (loadingFormat) return;

        setLoadingFormat(format);

        // Show immediate feedback
        toast({
            status: "info",
            title: `Preparing ${format.toUpperCase()}`,
            description: "Fetching your document...",
            duration: 2000,
        });

        try {
            // Request document rendition from the server
            const response = await client.objects.getRendition(object.id, {
                format: format as any, // We're extending the format type
                generate_if_missing: true,
                sign_url: true,
            });

            if (response.status === "generating") {
                toast({
                    status: "info",
                    title: "Generating document",
                    description: `Please wait while we prepare your ${format.toUpperCase()} file...`,
                    duration: 5000,
                });

                // Poll for completion
                setTimeout(() => handleExportDocument(format), 3000);
                return;
            }

            if (response.status === "failed") {
                throw new Error("Document generation failed");
            }

            // Download the generated file or open in new window
            if (response.renditions && response.renditions.length > 0) {
                const downloadUrl = response.renditions[0];

                if (format === 'pdf') {
                    // Open PDF in new window
                    window.open(downloadUrl, '_blank');
                    toast({
                        status: "success",
                        title: "PDF opened",
                        description: "PDF document opened in a new window",
                        duration: 2000,
                    });
                } else {
                    // Download DOCX file
                    const link = document.createElement("a");
                    link.href = downloadUrl;
                    link.download = `${object.name || "document"}.${format}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    toast({
                        status: "success",
                        title: "Document exported",
                        description: `Successfully exported to ${format.toUpperCase()} format`,
                        duration: 2000,
                    });
                }
            }
        } catch (err) {
            console.error(`Failed to export document as ${format}:`, err);
            toast({
                status: "error",
                title: "Export failed",
                description: `Failed to export document to ${format.toUpperCase()} format`,
                duration: 5000,
            });
        } finally {
            setLoadingFormat(null);
        }
    };

    const handleExportDocx = () => handleExportDocument("docx");
    const handleExportPdf = () => handleExportDocument("pdf");
    return (
        <div className="h-[41px] text-lg font-semibold flex justify-between items-center px-2">
            <div className="flex items-center gap-2">
                {text && (
                    <Button variant="ghost" size="sm" title="Copy text" className="flex items-center gap-2" onClick={() => handleCopyContent(text, "text")}>
                        <Copy className="size-4" />
                    </Button>
                )}
                {isMarkdown && text && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportDocx}
                            disabled={loadingFormat !== null}
                            className="flex items-center gap-2"
                        >
                            {loadingFormat === "docx" ? (
                                <Spinner size="sm" />
                            ) : (
                                <Download className="size-4" />
                            )}
                            DOCX
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportPdf}
                            disabled={loadingFormat !== null}
                            className="flex items-center gap-2"
                        >
                            {loadingFormat === "pdf" ? (
                                <Spinner size="sm" />
                            ) : (
                                <Download className="size-4" />
                            )}
                            PDF
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

function TextPanel({ object, text }: { object: ContentObject, text: string | undefined }) {
    const toast = useToast();
    const { client } = useUserSession();

    const content = object.content;

    // Only render as markdown if content type is explicitly markdown
    const isMarkdown =
        content &&
        content.type &&
        content.type === "text/markdown";

    const handleExportDocument = async (format: "docx" | "pdf") => {
        try {
            // Request document rendition from the server
            const response = await client.objects.getRendition(object.id, {
                format: format as any, // We're extending the format type
                generate_if_missing: true,
                sign_url: true,
            });

            if (response.status === "generating") {
                toast({
                    status: "info",
                    title: "Generating document",
                    description: `Please wait while we prepare your ${format.toUpperCase()} file...`,
                    duration: 5000,
                });

                // Poll for completion
                setTimeout(() => handleExportDocument(format), 3000);
                return;
            }

            if (response.status === "failed") {
                throw new Error("Document generation failed");
            }

            // Download the generated file or open in new window
            if (response.renditions && response.renditions.length > 0) {
                const downloadUrl = response.renditions[0];

                if (format === 'pdf') {
                    // Open PDF in new window
                    window.open(downloadUrl, '_blank');
                    toast({
                        status: "success",
                        title: "PDF opened",
                        description: "PDF document opened in a new window",
                        duration: 2000,
                    });
                } else {
                    // Download DOCX file
                    const link = document.createElement("a");
                    link.href = downloadUrl;
                    link.download = `${object.name || "document"}.${format}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    toast({
                        status: "success",
                        title: "Document exported",
                        description: `Successfully exported to ${format.toUpperCase()} format`,
                        duration: 2000,
                    });
                }
            }
        } catch (err) {
            console.error(`Failed to export document as ${format}:`, err);
            toast({
                status: "error",
                title: "Export failed",
                description: `Failed to export document to ${format.toUpperCase()} format`,
                duration: 5000,
            });
        }
    };

    return (
        text ? (
            <>
                <div className="max-w-7xl px-2 h-[calc(100vh-210px)] overflow-auto">
                    {isMarkdown ? (
                        <div className="vprose prose-sm p-1">
                            <MarkdownRenderer
                                components={{
                                    a: ({ node, ...props }: { node?: any; href?: string; children?: React.ReactNode }) => {
                                        const href = props.href || "";
                                        if (href.includes("/store/objects/")) {
                                            return (
                                                <NavLink
                                                    topLevelNav
                                                    href={href}
                                                    className="text-info"
                                                >
                                                    {props.children}
                                                </NavLink>
                                            );
                                        }
                                        return <a {...props} data-debug="test" target="_blank" rel="noopener noreferrer" />;
                                    },
                                    p: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <p {...props} className={`my-0`} />
                                    ),
                                    pre: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <pre {...props} className={`my-2 p-2 rounded`} />
                                    ),
                                    code: ({
                                        node,
                                        className,
                                        children,
                                        ...props
                                    }: {
                                        node?: any;
                                        className?: string;
                                        children?: React.ReactNode;
                                    }) => {
                                        const match = /language-(\w+)/.exec(className || "");
                                        const isInline = !match;
                                        return (
                                            <code
                                                {...props}
                                                className={
                                                    isInline
                                                        ? `px-1.5 py-0.5 rounded`
                                                        : "text-muted"
                                                }
                                            >
                                                {children}
                                            </code>
                                        );
                                    },
                                    h1: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <h1 {...props} className={`font-bold text-2xl my-2`} />
                                    ),
                                    h2: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <h2 {...props} className={`font-bold text-xl my-2`} />
                                    ),
                                    h3: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <h3 {...props} className={`font-bold text-lg my-2`} />
                                    ),
                                    li: ({ node, ...props }: { node?: any; children?: React.ReactNode }) => (
                                        <li {...props} />
                                    ),
                                }}
                            >
                                {text}
                            </MarkdownRenderer>
                        </div>
                    ) : (
                        <pre className="text-wrap bg-muted text-muted p-2">
                            {text}
                        </pre>
                    )}
                </div>
            </>
        ) :
            <div className="px-2">
                <div>No content</div>
            </div>
    );
}

function ImagePanel({ object }: { object: ContentObject }) {
    const { client } = useUserSession();
    const [imageUrl, setImageUrl] = useState<string>();

    const content = object.content;
    const isImage = object.metadata && object.metadata.type === ContentNature.Image;

    useEffect(() => {
        if (isImage) {
            const loadImage = async () => {
                const webSupportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
                const isOriginalWebSupported = content?.type && webSupportedFormats.includes(content.type);

                try {
                    const rendition = await client.objects.getRendition(object.id, {
                        format: ImageRenditionFormat.jpeg,
                        generate_if_missing: false,
                        sign_url: true,
                    });

                    if (rendition.status === "found" && rendition.renditions?.length) {
                        // Use rendition URL directly
                        setImageUrl(rendition.renditions[0]);
                    } else if (isOriginalWebSupported) {
                        // Fall back to original file only if web-supported
                        const downloadUrl = await client.files.getDownloadUrl(object.content.source!);
                        setImageUrl(downloadUrl.url);
                    }
                } catch (error) {
                    // Fall back to original file only if web-supported
                    if (isOriginalWebSupported) {
                        const downloadUrl = await client.files.getDownloadUrl(object.content.source!);
                        setImageUrl(downloadUrl.url);
                    }
                }
            };

            loadImage();
        }
    }, []);

    return (
        <div className="mb-4 px-2">
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={object.name}
                    className="w-full object-contain"
                />
            ) : (
                <Spinner size="md" />
            )}
        </div>
    );
}

function VideoPanel({ object }: { object: ContentObject }) {
    const { client } = useUserSession();
    const [videoUrl, setVideoUrl] = useState<string>();
    const [posterUrl, setPosterUrl] = useState<string>();
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const content = object.content;
    const isVideo = object.metadata?.type === ContentNature.Video;

    // Check if there are mp4 or webm renditions available in metadata
    const metadata = object.metadata as VideoMetadata;
    const renditions = metadata?.renditions || [];

    // Find mp4 or webm rendition by mime type, preferring mp4
    const webRendition = renditions.find(r => r.content.type === 'video/mp4') ||
                         renditions.find(r => r.content.type === 'video/webm');

    // Check if original file is web-compatible
    const webSupportedFormats = ['video/mp4', 'video/webm'];
    const isOriginalWebSupported = content?.type && webSupportedFormats.includes(content.type);

    // Get poster
    const poster = renditions.find(r => r.name === POSTER_RENDITION_NAME);

    useEffect(() => {
        const loadPoster = async () => {
            if (poster?.content?.source) {
                try {
                    const response = await client.files.getDownloadUrl(poster.content.source);
                    setPosterUrl(response.url);
                } catch (error) {
                    console.error("Failed to load poster image", error);
                }
            }
        };
        loadPoster();
    }, [poster, client]);

    useEffect(() => {
        if (isVideo && (webRendition?.content?.source || isOriginalWebSupported)) {
            const loadVideoUrl = async () => {
                try {
                    let downloadUrl;
                    if (webRendition?.content?.source) {
                        // Use rendition if available
                        downloadUrl = await client.files.getDownloadUrl(webRendition.content.source);
                    } else if (isOriginalWebSupported && content?.source) {
                        // Fall back to original file if web-supported
                        downloadUrl = await client.files.getDownloadUrl(content.source);
                    }
                    if (downloadUrl) {
                        setVideoUrl(downloadUrl.url);
                    }
                } catch (error) {
                    console.error("Failed to get video URL", error);
                } finally {
                    setIsLoading(false);
                }
            };
            loadVideoUrl();
        } else {
            setIsLoading(false);
        }
    }, [isVideo, webRendition, isOriginalWebSupported, content?.source, client]);

    return (
        <div className="mb-4 px-2">
            {!webRendition && !isOriginalWebSupported ? (
                <div className="flex justify-center items-center h-[400px] text-muted">
                    <div className="text-center">
                        <p>No web-compatible video rendition available</p>
                        <p className="text-sm mt-2">MP4 or WebM format required</p>
                    </div>
                </div>
            ) : isLoading ? (
                <div className="flex justify-center items-center h-[400px]">
                    <Spinner size="md" />
                </div>
            ) : videoUrl ? (
                <video
                    src={videoUrl}
                    poster={posterUrl}
                    controls
                    className="w-full max-h-[calc(100vh-260px)] object-contain"
                >
                    Your browser does not support the video tag.
                </video>
            ) : (
                <div className="flex justify-center items-center h-[400px] text-muted">
                    Failed to load video
                </div>
            )}
        </div>
    );
}