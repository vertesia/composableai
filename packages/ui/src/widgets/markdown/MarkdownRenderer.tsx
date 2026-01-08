import { useUserSession } from "@vertesia/ui/session";
import { useCodeBlockRendererRegistry } from "./CodeBlockRendering";
import type { Element } from "hast";
import React from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { SKIP, visit } from "unist-util-visit";
import { AgentChart, type AgentChartSpec } from "../../features/agent/chat/AgentChart";
import { AskUserWidget, type AskUserWidgetProps } from "../../features/agent/chat/AskUserWidget";
import { useArtifactUrlCache, getArtifactCacheKey, getFileCacheKey } from "../../features/agent/chat/useArtifactUrlCache.js";

// Custom URL schemes that we handle in our components
const ALLOWED_CUSTOM_SCHEMES = [
    'artifact:',
    'image:',
    'store:',
    'document:',
    'document://',
    'collection:',
];

/**
 * Custom URL transform that allows our custom schemes while using
 * the default transform for standard URLs (which sanitizes unsafe schemes).
 */
function customUrlTransform(url: string): string {
    // Allow our custom schemes - they're handled by our custom components
    if (ALLOWED_CUSTOM_SCHEMES.some(scheme => url.startsWith(scheme))) {
        return url;
    }
    // Fall back to default sanitization for other URLs
    return defaultUrlTransform(url);
}

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

export interface MarkdownRendererProps {
    children: string;
    components?: any;
    remarkPlugins?: any[];
    removeComments?: boolean;
    /**
     * Optional workflow run id used to resolve shorthand artifact paths (e.g. artifact:out/result.csv)
     */
    artifactRunId?: string;
    /** Additional className for the markdown wrapper */
    className?: string;
    /** Additional className for code blocks */
    codeClassName?: string;
    /** Additional className for inline code */
    inlineCodeClassName?: string;
    /** Additional className for links */
    linkClassName?: string;
    /** Additional className for images */
    imageClassName?: string;
    /** Callback when user selects a proposal option */
    onProposalSelect?: (optionId: string) => void;
    /** Callback when user submits free-form response to proposal */
    onProposalSubmit?: (response: string) => void;
}

export function MarkdownRenderer({
    children,
    components,
    remarkPlugins = [],
    removeComments = true,
    artifactRunId,
    className,
    codeClassName,
    inlineCodeClassName,
    linkClassName,
    imageClassName,
    onProposalSelect,
    onProposalSubmit,
}: MarkdownRendererProps) {
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();
    const codeBlockRegistry = useCodeBlockRendererRegistry();
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
            node?: Element;
            className?: string;
            children?: React.ReactNode;
        }) => {
            const match = /language-([\w-]+)/.exec(className || "");
            const isInline = !match;
            const language = match ? match[1] : "";

            // Check if there's a custom renderer for this language
            if (!isInline && language && codeBlockRegistry) {
                const CustomComponent = codeBlockRegistry.getComponent(language);
                if (CustomComponent) {
                    const code = String(children || "").trim();
                    return <CustomComponent code={code} />;
                }
            }

            if (!isInline && (language === "chart" || className?.includes("language-chart"))) {
                try {
                    let raw = String(children || "").trim();
                    // Extract just the JSON object - handle cases where extra content is appended
                    const jsonStart = raw.indexOf('{');
                    const jsonEnd = raw.lastIndexOf('}');
                    if (jsonStart !== -1 && jsonEnd > jsonStart) {
                        raw = raw.slice(jsonStart, jsonEnd + 1);
                    }
                    const spec = JSON.parse(raw) as Record<string, unknown>;
                    // Support Vega-Lite, Recharts, and native Vega-Lite JSON with $schema
                    if (spec) {
                        // Detect Vega-Lite by $schema containing "vega"
                        const hasVegaSchema = typeof spec.$schema === 'string' && spec.$schema.includes('vega');
                        const isVegaLite = spec.library === 'vega-lite' && 'spec' in spec;
                        // Recharts: check for 'chart' property OR library === 'recharts' with data
                        const isRecharts = (
                            ('chart' in spec || 'type' in spec || spec.library === 'recharts') &&
                            'data' in spec &&
                            Array.isArray(spec.data)
                        );
                        if (hasVegaSchema || isVegaLite || isRecharts) {
                            // Wrap native Vega-Lite spec in expected format
                            const chartSpec = hasVegaSchema && !isVegaLite
                                ? { library: 'vega-lite', spec }
                                : spec;
                            return <AgentChart spec={chartSpec as AgentChartSpec} artifactRunId={artifactRunId} />;
                        }
                    }
                } catch (e) {
                    // Not valid JSON or not a chart - fall through to regular code rendering
                }
            }

            // Detect proposal/askuser blocks
            if (!isInline && (language === "proposal" || language === "askuser")) {
                try {
                    const raw = String(children || "").trim();
                    const spec = JSON.parse(raw);

                    if (spec.options && (spec.question || spec.title)) {
                        const widgetProps: AskUserWidgetProps = {
                            question: spec.question || spec.title || '',
                            description: spec.description,
                            options: Array.isArray(spec.options)
                                ? spec.options.map((opt: any) => ({
                                    id: opt.id || opt.value || '',
                                    label: opt.label || '',
                                    description: opt.description,
                                }))
                                : undefined,
                            allowFreeResponse: spec.allowFreeResponse ?? spec.multiple,
                            variant: spec.variant,
                            onSelect: onProposalSelect,
                            onSubmit: onProposalSubmit,
                        };

                        if (widgetProps.question && widgetProps.options && widgetProps.options.length > 0) {
                            return <AskUserWidget {...widgetProps} />;
                        }
                    }
                } catch (e) {
                    // Not valid JSON or not a proposal - fall through to regular code rendering
                }
            }

            if (typeof ExistingCode === "function") {
                return <ExistingCode node={node} className={className} {...props}>{children}</ExistingCode>;
            }

            const baseInlineClass = "px-1.5 py-0.5 rounded";
            const baseCodeClass = "text-muted";

            return (
                <code
                    {...props}
                    className={
                        isInline
                            ? `${baseInlineClass} ${inlineCodeClassName || ""}`
                            : `${baseCodeClass} ${codeClassName || ""}`
                    }
                >
                    {children}
                </code>
            );
        };

        const LinkComponent = (props: { node?: Element; href?: string; children?: React.ReactNode }) => {
            const { node, href, children, ...rest } = props as any;
            const rawHref = href || "";
            const isArtifactLink = rawHref.startsWith("artifact:");
            const artifactPath = isArtifactLink ? rawHref.replace(/^artifact:/, "").trim() : "";
            const isImageLink = rawHref.startsWith("image:");
            const imagePath = isImageLink ? rawHref.replace(/^image:/, "").trim() : "";
            const [resolvedHref, setResolvedHref] = React.useState<string | undefined>(() => {
                // Initialize from cache if available
                if (urlCache) {
                    if (isArtifactLink && artifactRunId && !artifactPath.startsWith("agents/")) {
                        return urlCache.getUrl(getArtifactCacheKey(artifactRunId, artifactPath, "attachment"));
                    } else if (isArtifactLink) {
                        return urlCache.getUrl(getFileCacheKey(artifactPath));
                    } else if (isImageLink) {
                        return urlCache.getUrl(getFileCacheKey(imagePath));
                    }
                }
                return undefined;
            });

            React.useEffect(() => {
                // Skip if already resolved from cache
                if (resolvedHref) return;

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
                                const cacheKey = getArtifactCacheKey(artifactRunId, artifactPath, "attachment");
                                let url: string;
                                if (urlCache) {
                                    url = await urlCache.getOrFetch(cacheKey, async () => {
                                        const result = await client.files.getArtifactDownloadUrl(artifactRunId, artifactPath, "attachment");
                                        return result.url;
                                    });
                                } else {
                                    const result = await client.files.getArtifactDownloadUrl(artifactRunId, artifactPath, "attachment");
                                    url = result.url;
                                }
                                if (!cancelled) {
                                    setResolvedHref(url);
                                }
                            } else {
                                // Otherwise, treat it as a direct file path.
                                const cacheKey = getFileCacheKey(artifactPath);
                                let url: string;
                                if (urlCache) {
                                    url = await urlCache.getOrFetch(cacheKey, async () => {
                                        const result = await client.files.getDownloadUrl(artifactPath);
                                        return result.url;
                                    });
                                } else {
                                    const result = await client.files.getDownloadUrl(artifactPath);
                                    url = result.url;
                                }
                                if (!cancelled) {
                                    setResolvedHref(url);
                                }
                            }
                        } else if (isImageLink) {
                            // image:<path> is treated as a direct file path resolved via files API
                            const cacheKey = getFileCacheKey(imagePath);
                            let url: string;
                            if (urlCache) {
                                url = await urlCache.getOrFetch(cacheKey, async () => {
                                    const result = await client.files.getDownloadUrl(imagePath);
                                    return result.url;
                                });
                            } else {
                                const result = await client.files.getDownloadUrl(imagePath);
                                url = result.url;
                            }
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
            }, [isArtifactLink, artifactPath, isImageLink, imagePath, artifactRunId, client, resolvedHref, urlCache]);

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
                        className={linkClassName}
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
                        className={linkClassName}
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
                        className={linkClassName}
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
                        className={linkClassName}
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
                        className={linkClassName}
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
                    className={linkClassName}
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
            const [resolvedSrc, setResolvedSrc] = React.useState<string | undefined>(() => {
                // Initialize from cache if available
                if (urlCache && isArtifactOrImageRef) {
                    if (isArtifactRef && artifactRunId && !path.startsWith("agents/")) {
                        return urlCache.getUrl(getArtifactCacheKey(artifactRunId, path, "inline"));
                    } else if (isArtifactRef) {
                        return urlCache.getUrl(getFileCacheKey(path));
                    } else if (isImageRef) {
                        return urlCache.getUrl(getFileCacheKey(path));
                    }
                }
                return undefined;
            });

            React.useEffect(() => {
                // Skip if already resolved from cache
                if (resolvedSrc) return;

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
                                const cacheKey = getArtifactCacheKey(artifactRunId, path, "inline");
                                let url: string;
                                if (urlCache) {
                                    url = await urlCache.getOrFetch(cacheKey, async () => {
                                        const result = await client.files.getArtifactDownloadUrl(artifactRunId, path, "inline");
                                        return result.url;
                                    });
                                } else {
                                    const result = await client.files.getArtifactDownloadUrl(artifactRunId, path, "inline");
                                    url = result.url;
                                }
                                if (!cancelled) {
                                    setResolvedSrc(url);
                                }
                            } else {
                                const cacheKey = getFileCacheKey(path);
                                let url: string;
                                if (urlCache) {
                                    url = await urlCache.getOrFetch(cacheKey, async () => {
                                        const result = await client.files.getDownloadUrl(path);
                                        return result.url;
                                    });
                                } else {
                                    const result = await client.files.getDownloadUrl(path);
                                    url = result.url;
                                }
                                if (!cancelled) {
                                    setResolvedSrc(url);
                                }
                            }
                        } else if (isImageRef) {
                            // image:<path> is always resolved via files API
                            const cacheKey = getFileCacheKey(path);
                            let url: string;
                            if (urlCache) {
                                url = await urlCache.getOrFetch(cacheKey, async () => {
                                    const result = await client.files.getDownloadUrl(path);
                                    return result.url;
                                });
                            } else {
                                const result = await client.files.getDownloadUrl(path);
                                url = result.url;
                            }
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
            }, [isArtifactOrImageRef, path, artifactRunId, client, resolvedSrc, urlCache]);

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
                        className={imageClassName}
                        {...rest}
                    />
                );
            }

            // Default image behavior
            return (
                <img
                    src={src}
                    alt={alt}
                    className={imageClassName}
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
    }, [components, client, artifactRunId, urlCache, codeClassName, inlineCodeClassName, linkClassName, imageClassName, onProposalSelect, onProposalSubmit]);

    const markdownContent = (
        <Markdown
            remarkPlugins={plugins}
            components={componentsWithCharts}
            urlTransform={customUrlTransform}
        >
            {children}
        </Markdown>
    );

    // Wrap in a div if className is provided, otherwise return Markdown directly
    if (className) {
        return <div className={className}>{markdownContent}</div>;
    }

    return markdownContent;
}
