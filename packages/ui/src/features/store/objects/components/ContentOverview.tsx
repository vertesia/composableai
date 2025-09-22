import { useEffect, useState } from "react";

import { useUserSession } from "@vertesia/ui/session";
import { Button, ResizableHandle, ResizablePanel, ResizablePanelGroup, Spinner, useToast } from "@vertesia/ui/core";
import { JSONDisplay, MarkdownRenderer } from "@vertesia/ui/widgets";
import { ContentObject, ImageRenditionFormat } from "@vertesia/common";
import { Copy, Download, SquarePen } from "lucide-react";
import { PropertiesEditorModal } from "./PropertiesEditorModal";
import { NavLink } from "@vertesia/ui/router";

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
    const [viewImage, setViewImage] = useState(false);

    const content = object.content;
    const isImage =
        content && content.type && content.type.startsWith("image/");

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
                    <Button
                        variant={`${viewImage ? "ghost" : "primary"}`}
                        size="sm"
                        alt="Preview properties"
                        onClick={() => setViewImage(!viewImage)}
                    >
                        Text
                    </Button>
                    {isImage &&
                        <Button
                            variant={`${viewImage ? "primary" : "ghost"}`}
                            size="sm"
                            alt="View in JSON format"
                            onClick={() => setViewImage(!viewImage)}
                        >
                            Image
                        </Button>
                    }

                </div>
                {!viewImage && <TextActions object={object} text={text} handleCopyContent={handleCopyContent} />}
            </div>
            {
                viewImage ? (
                    <ImagePanel object={object} />
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

    const content = object.content;

    const isMarkdownOrText =
        content &&
        content.type &&
        (content.type === "text/markdown" || content.type === "text/plain");

    // Check for markdown indicators, ignoring any HTML comments
    const seemsMarkdown =
        text &&
        // Look for markdown indicators
        (text.includes("\n#") ||
            text.includes("\n*") ||
            text.includes("\n+") ||
            text.includes("!["));

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
                {(isMarkdownOrText || seemsMarkdown) && text && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportDocx}
                            className="flex items-center gap-2"
                        >
                            <Download className="size-4" />
                            DOCX
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportPdf}
                            className="flex items-center gap-2"
                        >
                            <Download className="size-4" />
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

    // Check for markdown indicators, ignoring any HTML comments
    const seemsMarkdown =
        text &&
        // Look for markdown indicators
        (text.includes("\n#") ||
            text.includes("\n*") ||
            text.includes("\n+") ||
            text.includes("!["));

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
                <div className="max-w-7xl px-2">
                    {seemsMarkdown ? (
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
    const isImage =
        content && content.type && content.type.startsWith("image/");

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
}``