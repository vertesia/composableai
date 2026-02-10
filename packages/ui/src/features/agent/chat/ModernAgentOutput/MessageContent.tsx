import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { Button } from "@vertesia/ui/core";
import { NavLink } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import React, { useEffect, useState } from "react";
import { AnimatedThinkingDots } from "../AnimatedThinkingDots";
import { ThinkingMessages } from "../WaitingMessages";

/**
 * Artifact link resolved from message details
 */
export interface ArtifactLink {
    displayName: string;
    artifactPath: string;
    url: string;
    isImage: boolean;
}

export interface MessageContentProps {
    /** The agent message to render content for */
    message: AgentMessage;
    /** Optional run ID for artifact resolution */
    artifactRunId?: string;
    /** Optional custom artifact renderer */
    renderArtifacts?: (artifacts: ArtifactLink[]) => React.ReactNode;
    /** Optional custom component overrides for MarkdownRenderer */
    components?: Record<string, React.ComponentType<any>>;
}

/**
 * MessageContent - Handles the content rendering logic for agent messages.
 *
 * This component is responsible for:
 * - Markdown rendering with chart detection
 * - Artifact URL resolution and display
 * - Proposal/AskUser widgets
 * - Link scheme resolution (artifact:, store:, collection:)
 *
 * It does NOT handle:
 * - Wrapper styling (borders, shadows, backgrounds)
 * - Icons and headers
 * - Timestamp display
 * - Copy buttons
 * - Thinking animations (those belong in the wrapper)
 *
 * This allows consumers to wrap MessageContent in their own styled container
 * while getting all the content rendering logic automatically.
 */
export function MessageContent({
    message,
    artifactRunId,
    renderArtifacts,
    components: customComponents,
}: MessageContentProps) {
    const { client } = useUserSession();
    const [processedContent, setProcessedContent] = useState<string | object>("");
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    const [artifactLinks, setArtifactLinks] = useState<ArtifactLink[]>([]);

    // Get the message content to display with thinking message replacement
    const getMessageContent = () => {
        let content = "";

        if (message.message) {
            if (typeof message.message === "object") {
                content = JSON.stringify(message.message, null, 2);
            } else if (message.message.trim) {
                content = message.message.trim();
            } else {
                content = String(message.message);
            }
        }

        // Replace %thinking_message% placeholder with a thinking message
        if (typeof content === "string" && content.includes("%thinking_message%")) {
            const randomIndex = Math.floor(Math.random() * ThinkingMessages.length);
            content = content.replace(/%thinking_message%/g, ThinkingMessages[randomIndex]);
        }

        return content;
    };

    // Process content to enhance markdown detection for lists and thinking messages
    const processContentForMarkdown = (content: string | object) => {
        if (typeof content !== "string") {
            return content;
        }

        // Special handling for thought messages to ensure proper markdown formatting
        if (
            message.type === AgentMessageType.THOUGHT ||
            (typeof message.message === "string" &&
                (message.message.toLowerCase().includes("thinking about") ||
                    message.message.toLowerCase().includes("i'm thinking") ||
                    message.message.toLowerCase().includes("💭")))
        ) {
            let formattedContent = content;

            // Check for numbering patterns like "1. First item 2. Second item"
            if (/\d+\.\s+.+/.test(formattedContent)) {
                formattedContent = formattedContent.replace(/(\d+\.\s+.+?)(?=\s+\d+\.\s+|$)/g, "$1\n\n");
                formattedContent = formattedContent.replace(/(\d+\.\s+.+\n)([^\d\n][^:])/g, "$1  $2");
            }

            // Handle colon-prefixed items that should be on separate lines
            if (formattedContent.includes(":") && !formattedContent.includes("\n\n")) {
                formattedContent = formattedContent.replace(
                    /\b(First|Next|Then|Finally|Lastly|Additionally|Step \d+):\s+/gi,
                    "\n\n$&",
                );
            }

            // Handle thinking points or list-like structures even without numbers
            if (formattedContent.includes(" - ")) {
                formattedContent = formattedContent.replace(/\s+-\s+/g, "\n- ");
            }

            return formattedContent;
        }

        // Normal processing for non-thinking messages
        if (/\d+\.\s+.+/.test(content) && !content.includes("\n\n")) {
            return content.replace(/(\d+\.\s+.+?)(?=\s+\d+\.\s+|$)/g, "$1\n\n");
        }

        return content;
    };

    // Convert links - currently a passthrough, but structured for future enhancements
    const convertLinks = async (content: string | object): Promise<string | object> => {
        if (typeof content !== "string") {
            return content;
        }
        return content;
    };

    // Render content with markdown support
    const renderContent = (content: string | object) => {
        // Handle object content (JSON)
        if (typeof content === "object") {
            return (
                <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-gray-100 dark:bg-gray-800 p-2 rounded text-gray-700">
                    {JSON.stringify(content, null, 2)}
                </pre>
            );
        }

        // Handle string content with markdown
        const runId = artifactRunId || (message as any).workflow_run_id as string | undefined;

        // Default component overrides
        const defaultComponents = {
            a: ({ node, ref, ...props }: { node?: any; ref?: any; href?: string; children?: React.ReactNode }) => {
                const href = props.href || "";
                if (href.includes("/store/objects")) {
                    return (
                        <NavLink href={href} topLevelNav>
                            {props.children}
                        </NavLink>
                    );
                }
                return (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                );
            },
            img: ({ node, ref, ...props }: { node?: any; ref?: any; src?: string; alt?: string }) => {
                return (
                    <img
                        {...props}
                        className="max-w-full h-auto rounded-lg shadow-md my-3 cursor-pointer hover:shadow-lg transition-shadow"
                        loading="lazy"
                        onClick={() => props.src && window.open(props.src, "_blank")}
                    />
                );
            },
        };

        // Merge custom components (custom wins over defaults)
        const mergedComponents = { ...defaultComponents, ...customComponents };

        return (
            <div className="vprose prose-sm">
                <MarkdownRenderer
                    artifactRunId={runId}
                    components={mergedComponents}
                >
                    {content as string}
                </MarkdownRenderer>
            </div>
        );
    };

    const messageContent = getMessageContent();

    // Resolve artifacts from tool details (e.g. execute_shell.outputFiles)
    useEffect(() => {
        const loadArtifacts = async () => {
            const runId = artifactRunId || (message as any).workflow_run_id as string | undefined;
            const details = message.details as any;
            const outputFiles: unknown = details && details.outputFiles;

            if (!runId || !Array.isArray(outputFiles) || outputFiles.length === 0) {
                setArtifactLinks([]);
                return;
            }

            try {
                const entries = await Promise.all(
                    outputFiles.map(async (name: unknown) => {
                        if (typeof name !== "string" || !name.trim()) return null;
                        const trimmed = name.trim();
                        const artifactPath =
                            trimmed.startsWith("out/") || trimmed.startsWith("files/") || trimmed.startsWith("scripts/")
                                ? trimmed
                                : `out/${trimmed}`;

                        const ext = artifactPath.split(".").pop()?.toLowerCase() || "";
                        const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
                        const isImage = imageExtensions.has(ext);

                        try {
                            const disposition = isImage ? "inline" : "attachment";
                            const { url } = await client.files.getArtifactDownloadUrl(runId, artifactPath, disposition);
                            return {
                                displayName: trimmed,
                                artifactPath,
                                url,
                                isImage,
                            };
                        } catch (err) {
                            console.error(`Failed to resolve artifact URL for ${artifactPath}`, err);
                            return null;
                        }
                    }),
                );

                setArtifactLinks(
                    entries.filter((e): e is ArtifactLink => !!e),
                );
            } catch (error) {
                console.error("Error loading artifact URLs from message details", error);
                setArtifactLinks([]);
            }
        };

        loadArtifacts();
    }, [message.details, message.timestamp, client, artifactRunId]);

    // Process content with image URL resolution when component mounts or message changes
    useEffect(() => {
        const processContent = async () => {
            if (messageContent) {
                setIsProcessingImages(true);
                try {
                    const processed = await convertLinks(processContentForMarkdown(messageContent));
                    setProcessedContent(processed);
                } catch (error) {
                    console.error("Error processing message content:", error);
                    setProcessedContent(messageContent);
                } finally {
                    setIsProcessingImages(false);
                }
            }
        };
        processContent();
    }, [messageContent, client]);

    // Default artifact renderer
    const defaultRenderArtifacts = (artifacts: ArtifactLink[]) => (
        <div className="mt-3 text-xs">
            <div className="font-medium text-muted mb-1">Artifacts</div>

            {/* Inline previews for image artifacts */}
            {artifacts.some(a => a.isImage) && (
                <div className="mb-2 flex flex-wrap gap-3">
                    {artifacts
                        .filter(a => a.isImage)
                        .map(({ displayName, artifactPath, url }) => (
                            <div
                                key={`${artifactPath}-preview`}
                                className="max-w-xs cursor-pointer"
                                onClick={() => window.open(url, "_blank")}
                            >
                                <img
                                    src={url}
                                    alt={displayName}
                                    className="max-w-full h-auto rounded-lg shadow-sm hover:shadow-md transition-shadow"
                                />
                                <div className="mt-1 text-[11px] text-muted truncate">
                                    {displayName}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* Buttons for all artifacts (files and images) */}
            <div className="flex flex-wrap gap-2 print:hidden">
                {artifacts.map(({ displayName, artifactPath, url }) => (
                    <Button
                        key={artifactPath + url}
                        variant="outline"
                        size="xs"
                        className="px-2 py-1 text-xs"
                        onClick={() => window.open(url, "_blank")}
                        title={artifactPath}
                    >
                        {displayName}
                    </Button>
                ))}
            </div>
        </div>
    );

    return (
        <>
            {/* Main content */}
            {messageContent && (
                <div className="message-content">
                    {isProcessingImages ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <AnimatedThinkingDots color="blue" />
                            <span>Loading images...</span>
                        </div>
                    ) : (
                        renderContent(processedContent || messageContent)
                    )}
                </div>
            )}

            {/* Artifacts */}
            {artifactLinks.length > 0 && (
                renderArtifacts ? renderArtifacts(artifactLinks) : defaultRenderArtifacts(artifactLinks)
            )}
        </>
    );
}

export default MessageContent;
