import { useCodeBlockRendererRegistry } from './CodeBlockRendering';
import type { Element } from 'hast';
import React from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkAlert from 'remark-github-blockquote-alert';
import { remarkDefinitionList, defListHastHandlers } from 'remark-definition-list';
import remarkSupersub from 'remark-supersub';
import rehypeKatex from 'rehype-katex';
import { SKIP, visit } from 'unist-util-visit';
import { MarkdownLink } from './MarkdownLink';
import { MarkdownImage } from './MarkdownImage';
import { MarkdownFigure } from './MarkdownFigure';
import { remarkDirectiveHandler } from './remarkDirectiveHandler';
import { normalizeCustomSchemeLinks } from './normalizeCustomSchemeLinks';
import { normalizeDirectives } from './normalizeDirectives';
import {
    CodeBlockHandlerProvider,
    createDefaultCodeBlockHandlers,
    isExpandLanguage,
    ExpandCodeBlockHandler,
} from './codeBlockHandlers';

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
    if (ALLOWED_CUSTOM_SCHEMES.some(scheme => url.startsWith(scheme))) {
        return url;
    }
    return defaultUrlTransform(url);
}

/**
 * Remark plugin to remove HTML comments from markdown
 */
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

// Create default handlers once, outside component
const defaultCodeBlockHandlers = createDefaultCodeBlockHandlers();

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
    const codeBlockRegistry = useCodeBlockRendererRegistry();
    const normalizedMarkdown = React.useMemo(
        () => normalizeDirectives(normalizeCustomSchemeLinks(children)),
        [children]
    );

    // Remark plugins (markdown parsing)
    // Order matters: GFM first, then directive (must precede handler),
    // then definition-list/supersub, then math, then user plugins.
    const remarkPluginsArray = React.useMemo(() => {
        const result: any[] = [
            remarkGfm,
            remarkDirective,
            remarkDirectiveHandler,
            remarkAlert,
            remarkDefinitionList,
            remarkSupersub,
            remarkMath,
            ...remarkPlugins,
        ];
        if (removeComments) {
            result.push(remarkRemoveComments);
        }
        return result;
    }, [remarkPlugins, removeComments]);

    // Rehype plugins (HTML processing, including KaTeX for math)
    const rehypePluginsArray = React.useMemo(() => [rehypeKatex], []);

    // Remark-rehype bridge options (custom AST handlers for definition lists)
    const remarkRehypeOptions = React.useMemo(() => ({
        handlers: {
            ...defListHastHandlers,
        },
    }), []);

    const componentsWithOverrides = React.useMemo(() => {
        const baseComponents = components || {};
        const ExistingCode = baseComponents.code;
        const ExistingLink = baseComponents.a;
        const ExistingImg = baseComponents.img;

        const CodeComponent = ({
            node,
            className: codeClassName_,
            children: codeChildren,
            ...props
        }: {
            node?: Element;
            className?: string;
            children?: React.ReactNode;
        }) => {
            const match = /language-([\w-]+)/.exec(codeClassName_ || '');
            const isInline = !match;
            const language = match ? match[1] : '';

            // Check registry for custom renderer (includes default handlers)
            if (!isInline && language) {
                // First check user-provided registry
                if (codeBlockRegistry) {
                    const CustomComponent = codeBlockRegistry.getComponent(language);
                    if (CustomComponent) {
                        const code = String(codeChildren || '').trim();
                        return <CustomComponent code={code} language={language} />;
                    }
                }

                // Check for expand:* pattern (e.g., expand:chart, expand:table)
                if (isExpandLanguage(language)) {
                    const code = String(codeChildren || '').trim();
                    return <ExpandCodeBlockHandler code={code} language={language} />;
                }

                // Then check default handlers (chart, vega-lite, mermaid, proposal, askuser)
                const DefaultHandler = defaultCodeBlockHandlers[language];
                if (DefaultHandler) {
                    const code = String(codeChildren || '').trim();
                    return <DefaultHandler code={code} language={language} />;
                }
            }

            // Delegate to existing code component if provided
            if (typeof ExistingCode === 'function') {
                return (
                    <ExistingCode node={node} className={codeClassName_} {...props}>
                        {codeChildren}
                    </ExistingCode>
                );
            }

            // Default code rendering
            const baseInlineClass = 'px-1.5 py-0.5 rounded';
            const baseCodeClass = '';

            return (
                <code
                    {...props}
                    className={
                        isInline
                            ? `${baseInlineClass} ${inlineCodeClassName || ''}`
                            : `${baseCodeClass} ${codeClassName || ''}`
                    }
                >
                    {codeChildren}
                </code>
            );
        };

        const LinkComponent = (props: {
            node?: Element;
            href?: string;
            children?: React.ReactNode;
        }) => {
            const { node, href, children: linkChildren, ...rest } = props as any;
            return (
                <MarkdownLink
                    node={node}
                    href={href}
                    className={linkClassName}
                    artifactRunId={artifactRunId}
                    ExistingLink={ExistingLink}
                    {...rest}
                >
                    {linkChildren}
                </MarkdownLink>
            );
        };

        const ImageComponent = (props: { node?: any; src?: string; alt?: string; title?: string }) => {
            const { node, src, alt, title, ...rest } = props as any;

            // If image has a title, render as figure with caption
            if (title) {
                return (
                    <MarkdownFigure
                        src={src}
                        alt={alt}
                        caption={title}
                        className={imageClassName}
                        artifactRunId={artifactRunId}
                    />
                );
            }

            return (
                <MarkdownImage
                    node={node}
                    src={src}
                    alt={alt}
                    className={imageClassName}
                    artifactRunId={artifactRunId}
                    ExistingImg={ExistingImg}
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
    }, [
        components,
        artifactRunId,
        codeBlockRegistry,
        codeClassName,
        inlineCodeClassName,
        linkClassName,
        imageClassName,
    ]);

    const markdownContent = (
        <CodeBlockHandlerProvider
            artifactRunId={artifactRunId}
            onProposalSelect={onProposalSelect}
            onProposalSubmit={onProposalSubmit}
        >
            <Markdown
                remarkPlugins={remarkPluginsArray}
                rehypePlugins={rehypePluginsArray}
                remarkRehypeOptions={remarkRehypeOptions}
                components={componentsWithOverrides}
                urlTransform={customUrlTransform}
            >
                {normalizedMarkdown}
            </Markdown>
        </CodeBlockHandlerProvider>
    );

    if (className) {
        return <div className={`md-content ${className}`}>{markdownContent}</div>;
    }

    return <div className="md-content">{markdownContent}</div>;
}
