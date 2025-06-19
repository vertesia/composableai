import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useUserSession } from "@vertesia/ui/session";
import { Button, Link, Spinner, useToast } from "@vertesia/ui/core";
import { JSONDisplay } from "@vertesia/ui/widgets";
import { ContentObject, ImageRenditionFormat } from "@vertesia/common";
import { Copy, Download, SquarePen } from "lucide-react";
import { PropertiesEditorModal } from "./PropertiesEditorModal";

interface ContentOverviewProps {
    object: ContentObject;
    loadText?: boolean;
}
export function ContentOverview({
    object,
    loadText,
}: ContentOverviewProps) {
    const { client, store } = useUserSession();
    const [isLoadingText, setIsLoadingText] = useState(false);
    const [text, setText] = useState<string | undefined>(object.text);
    const [imageUrl, setImageUrl] = useState<string>();
    const [isPropertiesModalOpen, setPropertiesModalOpen] = useState(false);
    const toast = useToast();
    const [viewCode, setViewCode] = useState(false);
    const VIEW_JSON = "JSON";
    const VIEW_TEXT = "Preview";

    const handleOpenPropertiesModal = () => {
        setPropertiesModalOpen(true);
    };

    const handleClosePropertiesModal = () => {
        setPropertiesModalOpen(false);
    };

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

    const handleExportDocument = async (format: "docx" | "pdf") => {
        try {
            // Request document rendition from the server
            const response = await client.objects.getRendition(object.id, {
                format: format as any, // We're extending the format type
                max_hw: 1024, // Not used for document exports but required by API
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

    const content = object.content;
    const isImage =
        content &&
        content.source &&
        content.type &&
        content.type.startsWith("image/");
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

    useEffect(() => {
        if (isImage) {
            client.objects
                .getRendition(object.id, {
                    max_hw: 1024,
                    format: ImageRenditionFormat.jpeg,
                    generate_if_missing: false,
                    sign_url: true,
                })
                .then((r) => {
                    if (r.status === "found") {
                        return r.renditions?.length ? r.renditions[0] : null;
                    } else {
                        return object;
                    }
                })
                .catch(() => {
                    return object;
                })
                .then(() => {
                    client.files
                        .getDownloadUrl(object.content.source!)
                        .then((r) => {
                            setImageUrl(r.url);
                        });
                });
        }
    }, []);

    return (
        <div className="w-full">
            <div className="flex flex-col lg:flex-row lg:gap-8">
                <div className="w-full lg:w-1/2">
                    <div className="h-[41px] text-lg font-semibold mb-4 border-b flex justify-between items-center">
                        <div className="flex items-center gap-1">
                            Properties
                            <Button
                                variant="outline"
                                size="sm"
                                alt={`${viewCode ? "Preview" : "View in JSON format"}`}
                                onClick={() => setViewCode(!viewCode)}
                            >
                                {viewCode ? VIEW_TEXT : VIEW_JSON}
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
                    {object.properties ? (
                        <JSONDisplay
                            value={object.properties}
                            viewCode={viewCode}
                        />
                    ) : (
                        <div>No properties defined</div>
                    )}
                    {isImage && (
                        <div className="my-4">
                            <div className="h-[41px] text-lg font-semibold mb-4 border-b flex justify-between items-center">
                                <span className="py-1">Image</span>
                            </div>
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
                    )}
                </div>

                <div className="w-full lg:w-1/2 mt-4 lg:mt-0">
                    <div className="h-[41px] text-lg font-semibold mb-4 border-b flex justify-between items-center">
                        <span className="py-1">Text</span>
                        <div className="flex items-center gap-2">
                            {text && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Copy text"
                                    onClick={() =>
                                        handleCopyContent(text, "text")
                                    }
                                    className="flex items-center gap-2"
                                >
                                    <Copy className="h-4 w-4" />
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
                                        <Download className="h-4 w-4" />
                                        DOCX
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleExportPdf}
                                        className="flex items-center gap-2"
                                    >
                                        <Download className="h-4 w-4" />
                                        PDF
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                    {isLoadingText && <Spinner size="md" />}
                    {text ? (
                        <div className="border shadow-xs rounded-xs max-w-7xl">
                            {seemsMarkdown ? (
                                <div className="prose prose-sm max-w-none prose-p:bg-transparent prose-p:my-0 prose-pre:bg-gray-800 dark:prose-pre:bg-gray-900 prose-pre:my-2 prose-code:bg-gray-200/70 dark:prose-code:bg-gray-700/50 prose-headings:bg-transparent prose-li:bg-transparent dark:prose-invert dark:text-gray-100">
                                    <Markdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: ({
                                                node,
                                                ...props
                                            }: {
                                                node?: any;
                                                href?: string;
                                                children?: React.ReactNode;
                                            }) => {
                                                const href = props.href || "";
                                                if (
                                                    href.startsWith(
                                                        "/store/objects/",
                                                    )
                                                ) {
                                                    return (
                                                        <Link
                                                            href={href}
                                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                                        >
                                                            {props.children}
                                                        </Link>
                                                    );
                                                }
                                                return (
                                                    <a
                                                        {...props}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    />
                                                );
                                            },
                                            p: ({
                                                node,
                                                ...props
                                            }: {
                                                node?: any;
                                                children?: React.ReactNode;
                                            }) => (
                                                <p
                                                    {...props}
                                                    className="my-0 text-gray-800 dark:text-gray-100"
                                                />
                                            ),
                                            pre: ({
                                                node,
                                                ...props
                                            }: {
                                                node?: any;
                                                children?: React.ReactNode;
                                            }) => (
                                                <pre
                                                    {...props}
                                                    className="my-2 bg-gray-800 dark:bg-gray-900 p-2 rounded text-gray-100"
                                                />
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
                                                const match =
                                                    /language-(\w+)/.exec(
                                                        className || "",
                                                    );
                                                const isInline = !match;
                                                return (
                                                    <code
                                                        {...props}
                                                        className={
                                                            isInline
                                                                ? "px-1.5 py-0.5 rounded text-muted bg-gray-200/70 dark:bg-gray-700/50"
                                                                : "text-gray-100"
                                                        }
                                                    >
                                                        {children}
                                                    </code>
                                                );
                                            },
                                            h1: ({
                                                node,
                                                ...props
                                            }: {
                                                node?: any;
                                                children?: React.ReactNode;
                                            }) => (
                                                <h1
                                                    {...props}
                                                    className="text-gray-900 dark:text-gray-50 font-bold text-2xl my-2"
                                                />
                                            ),
                                            h2: ({
                                                node,
                                                ...props
                                            }: {
                                                node?: any;
                                                children?: React.ReactNode;
                                            }) => (
                                                <h2
                                                    {...props}
                                                    className="text-gray-900 dark:text-gray-50 font-bold text-xl my-2"
                                                />
                                            ),
                                            h3: ({
                                                node,
                                                ...props
                                            }: {
                                                node?: any;
                                                children?: React.ReactNode;
                                            }) => (
                                                <h3
                                                    {...props}
                                                    className="text-gray-900 dark:text-gray-50 font-bold text-lg my-2"
                                                />
                                            ),
                                            li: ({
                                                node,
                                                ...props
                                            }: {
                                                node?: any;
                                                children?: React.ReactNode;
                                            }) => (
                                                <li
                                                    {...props}
                                                    className="text-gray-800 dark:text-gray-100"
                                                />
                                            ),
                                        }}
                                    >
                                        {text}
                                    </Markdown>
                                </div>
                            ) : (
                                <pre className="text-wrap bg-muted text-muted p-2">
                                    {text}
                                </pre>
                            )}
                        </div>
                    ) : (
                        <div>No content</div>
                    )}
                </div>
            </div>

            {/* Properties Editor Modal */}
            <PropertiesEditorModal
                isOpen={isPropertiesModalOpen}
                onClose={handleClosePropertiesModal}
                object={object}
            />
        </div>
    );
}
