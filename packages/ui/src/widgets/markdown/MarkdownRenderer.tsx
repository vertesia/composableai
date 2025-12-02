import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit, SKIP } from "unist-util-visit";
import { AgentChart, type AgentChartSpec } from "../../features/agent/chat/AgentChart";
import { useUserSession } from "@vertesia/ui/session";

function remarkRemoveComments() {
    return (tree: any) => {
        visit(tree, 'html', (node: any, index: number | undefined, parent: any) => {
            if (node.value && /<!--[\s\S]*?-->/.test(node.value)) {
                if (parent && typeof index === 'number' && parent.children) {
                    parent.children.splice(index, 1);
                    return [SKIP, index];
                }
            }
        });
    };
}

interface MarkdownRendererProps {
    children: string;
    components?: any;
    remarkPlugins?: any[];
    removeComments?: boolean;
    /**
     * Optional workflow run id used to resolve shorthand artifact paths (e.g. artifact:out/result.csv)
     */
    artifactRunId?: string;
}

export function MarkdownRenderer({ 
    children, 
    components, 
    remarkPlugins = [], 
    removeComments = true,
    artifactRunId,
}: MarkdownRendererProps) {
    const { client } = useUserSession();
    const plugins = [remarkGfm, ...remarkPlugins];
    
    if (removeComments) {
        plugins.push(remarkRemoveComments);
    }

    const componentsWithCharts = React.useMemo(() => {
        const baseComponents = components || {};
        const ExistingCode = baseComponents.code;
        const ExistingLink = baseComponents.a;
        const ExistingImg = baseComponents.img;

        const CodeComponent = ({
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
            const language = match ? match[1] : "";

            if (!isInline && (language === "chart" || className?.includes("language-chart"))) {
                try {
                    const raw = String(children || "").trim();
                    const spec = JSON.parse(raw) as AgentChartSpec;
                    if (spec && spec.chart && Array.isArray(spec.data)) {
                        return <AgentChart spec={spec} />;
                    }
                } catch (e) {
                    console.warn("Failed to parse chart spec:", e);
                }
            }

            if (typeof ExistingCode === "function") {
                return <ExistingCode node={node} className={className} {...props}>{children}</ExistingCode>;
            }

            return (
                <code
                    {...props}
                    className={
                        isInline
                            ? "px-1.5 py-0.5 rounded"
                            : "text-muted"
                    }
                >
                    {children}
                </code>
            );
        };

        const LinkComponent = (props: { node?: any; href?: string; children?: React.ReactNode }) => {
            const { node, href, children, ...rest } = props as any;
            const rawHref = href || "";
            const isArtifactLink = rawHref.startsWith("artifact:");
            const artifactPath = isArtifactLink ? rawHref.replace(/^artifact:/, "").trim() : "";
            const isImageLink = rawHref.startsWith("image:");
            const imagePath = isImageLink ? rawHref.replace(/^image:/, "").trim() : "";
            const [resolvedHref, setResolvedHref] = React.useState<string | undefined>(undefined);

            React.useEffect(() => {
                let cancelled = false;
                const resolve = async () => {
                    if (!isArtifactLink && !isImageLink) {
                        setResolvedHref(undefined);
                        return;
                    }
                    try {
                        if (isArtifactLink) {
                            // If we have a run id and the path looks like a shorthand (e.g. out/...), use artifact API.
                            if (artifactRunId && !artifactPath.startsWith("agents/")) {
                                const { url } = await client.files.getArtifactDownloadUrl(
                                    artifactRunId,
                                    artifactPath,
                                    "attachment",
                                );
                                if (!cancelled) {
                                    setResolvedHref(url);
                                }
                            } else {
                                // Otherwise, treat it as a direct file path.
                                const { url } = await client.files.getDownloadUrl(artifactPath);
                                if (!cancelled) {
                                    setResolvedHref(url);
                                }
                            }
                        } else if (isImageLink) {
                            // image:<path> is treated as a direct file path resolved via files API
                            const { url } = await client.files.getDownloadUrl(imagePath);
                            if (!cancelled) {
                                setResolvedHref(url);
                            }
                        }
                    } catch (err) {
                        const contextPath = isArtifactLink ? artifactPath : imagePath;
                        console.error("Failed to resolve link in MarkdownRenderer:", contextPath, err);
                        if (!cancelled) {
                            setResolvedHref(undefined);
                        }
                    }
                };
                resolve();
                return () => {
                    cancelled = true;
                };
            }, [isArtifactLink, artifactPath, isImageLink, imagePath, artifactRunId, client]);

            // Handle document://<id> links by mapping them to /store/objects/<id>
            if (rawHref.startsWith("document://")) {
                const id = rawHref.replace(/^document:\/\//, "").trim();
                const mappedHref = id ? `/store/objects/${id}` : rawHref;

                if (typeof ExistingLink === "function") {
                    return <ExistingLink node={node} href={mappedHref} {...rest}>{children}</ExistingLink>;
                }

                return (
                    <a
                        href={mappedHref}
                        {...rest}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {children}
                    </a>
                );
            }

            // Handle store:<id> links by mapping them to /store/objects/<id>
            if (rawHref.startsWith("store:")) {
                const id = rawHref.replace(/^store:/, "").trim();
                const mappedHref = id ? `/store/objects/${id}` : rawHref;

                if (typeof ExistingLink === "function") {
                    return <ExistingLink node={node} href={mappedHref} {...rest}>{children}</ExistingLink>;
                }

                return (
                    <a
                        href={mappedHref}
                        {...rest}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {children}
                    </a>
                );
            }

            // Handle collection:<id> links by mapping them to /store/collections/<id>
            if (rawHref.startsWith("collection:")) {
                const id = rawHref.replace(/^collection:/, "").trim();
                const mappedHref = id ? `/store/collections/${id}` : rawHref;

                if (typeof ExistingLink === "function") {
                    return <ExistingLink node={node} href={mappedHref} {...rest}>{children}</ExistingLink>;
                }

                return (
                    <a
                        href={mappedHref}
                        {...rest}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {children}
                    </a>
                );
            }

            // Defer to existing link component if provided and not an artifact: URL
            if (!isArtifactLink && !isImageLink && typeof ExistingLink === "function") {
                return <ExistingLink node={node} href={href} {...rest}>{children}</ExistingLink>;
            }

            // Handle artifact: links generically by resolving to a signed URL when possible.
            if (isArtifactLink) {
                const finalHref = resolvedHref || "#";

                return (
                    <a
                        href={finalHref}
                        {...rest}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {children}
                    </a>
                );
            }

            // Handle image: links by resolving to a signed URL when possible.
            if (isImageLink) {
                const finalHref = resolvedHref || "#";

                return (
                    <a
                        href={finalHref}
                        {...rest}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {children}
                    </a>
                );
            }

            // Default link behavior
            return (
                <a
                    href={href}
                    {...rest}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {children}
                </a>
            );
        };

        const ImageComponent = (props: { node?: any; src?: string; alt?: string }) => {
            const { node, src, alt, ...rest } = props as any;
            const rawSrc = src || "";
            const isArtifactRef = rawSrc.startsWith("artifact:");
            const isImageRef = rawSrc.startsWith("image:");
            const isArtifactOrImageRef = isArtifactRef || isImageRef;
            const path = isArtifactOrImageRef ? rawSrc.replace(/^artifact:/, "").replace(/^image:/, "").trim() : "";
            const [resolvedSrc, setResolvedSrc] = React.useState<string | undefined>(undefined);

            React.useEffect(() => {
                let cancelled = false;
                const resolve = async () => {
                    if (!isArtifactOrImageRef) {
                        setResolvedSrc(undefined);
                        return;
                    }
                    try {
                        if (isArtifactRef) {
                            // Allow shorthand artifact paths when we have a run id
                            if (artifactRunId && !path.startsWith("agents/")) {
                                const { url } = await client.files.getArtifactDownloadUrl(
                                    artifactRunId,
                                    path,
                                    "inline",
                                );
                                if (!cancelled) {
                                    setResolvedSrc(url);
                                }
                            } else {
                                const { url } = await client.files.getDownloadUrl(path);
                                if (!cancelled) {
                                    setResolvedSrc(url);
                                }
                            }
                        } else if (isImageRef) {
                            // image:<path> is always resolved via files API
                            const { url } = await client.files.getDownloadUrl(path);
                            if (!cancelled) {
                                setResolvedSrc(url);
                            }
                        }
                    } catch (err) {
                        console.error("Failed to resolve image link in MarkdownRenderer:", path, err);
                        if (!cancelled) {
                            setResolvedSrc(undefined);
                        }
                    }
                };
                resolve();
                return () => {
                    cancelled = true;
                };
            }, [isArtifactOrImageRef, path, artifactRunId, client]);

            // If a custom img component was passed and this is not an artifact:/image: URL, delegate.
            if (!isArtifactOrImageRef && typeof ExistingImg === "function") {
                return <ExistingImg node={node} src={src} alt={alt} {...rest} />;
            }

            if (isArtifactOrImageRef) {
                if (!resolvedSrc) {
                    // Render nothing or a minimal placeholder until resolved
                    return null;
                }

                return (
                    <img
                        src={resolvedSrc}
                        alt={alt}
                        {...rest}
                    />
                );
            }

            // Default image behavior
            return (
                <img
                    src={src}
                    alt={alt}
                    {...rest}
                />
            );
        };

        return {
            ...baseComponents,
            code: CodeComponent,
            a: LinkComponent,
            img: ImageComponent,
        };
    }, [components, client, artifactRunId]);

    return (
        <Markdown 
            remarkPlugins={plugins}
            components={componentsWithCharts}
        >
            {children}
        </Markdown>
    );
}
