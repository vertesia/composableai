import { Editor, type Extensions, type JSONContent, type MarkdownToken, Node } from '@tiptap/core';
import { CodeBlock, type CodeBlockOptions } from '@tiptap/extension-code-block';
import { Image, type ImageOptions } from '@tiptap/extension-image';
import { Link, type LinkOptions } from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import {
    MarkViewContent,
    type MarkViewProps,
    NodeViewContent,
    NodeViewWrapper,
    ReactMarkViewRenderer,
    type ReactNodeViewProps,
    ReactNodeViewRenderer,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Marked, type marked } from 'marked';
import type { OpaqueMarkdownKind, RichTextRenderers } from './types.js';

export const VERTESIA_WIDGET_LANGUAGES = new Set(['chart', 'vega-lite', 'vegalite', 'mermaid', 'mockup', 'svg']);

const CUSTOM_PROTOCOLS = ['artifact', 'image', 'store', 'document', 'collection'];

interface VertesiaCodeBlockOptions extends CodeBlockOptions {
    renderer?: RichTextRenderers['codeBlock'];
}

interface VertesiaImageOptions extends ImageOptions {
    renderer?: RichTextRenderers['image'];
}

interface VertesiaLinkOptions extends LinkOptions {
    renderer?: RichTextRenderers['link'];
}

interface OpaqueMarkdownOptions {
    renderer?: RichTextRenderers['opaqueBlock'];
}

interface OpaqueMarkdownAttributes {
    kind: OpaqueMarkdownKind;
    raw: string;
}

export interface VertesiaMarkdownKitOptions extends RichTextRenderers {
    tables?: boolean;
    opaqueBlocks?: boolean;
}

export interface CreateMarkdownEditorOptions extends VertesiaMarkdownKitOptions {
    content?: string | JSONContent;
    editable?: boolean;
}

export function isVertesiaWidgetLanguage(language: string | null | undefined): boolean {
    return Boolean(language && (VERTESIA_WIDGET_LANGUAGES.has(language) || language.startsWith('expand:')));
}

function markdownDestination(value: string): string {
    if (!/[\s<>]/.test(value)) return value;
    return `<${value.replaceAll('>', '%3E')}>`;
}

function markdownTitle(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function markdownLabel(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function createIsolatedMarked(): typeof marked {
    // Tiptap types this option as the callable singleton even though MarkdownManager only
    // consumes the instance methods shared by Marked. A fresh instance prevents one editor's
    // custom tokenizers from accumulating globally across tests, remounts, and workspaces.
    return new Marked() as unknown as typeof marked;
}

function trimConsumedNewline(raw: string): string {
    return raw.endsWith('\n') ? raw.slice(0, -1) : raw;
}

function matchFrontmatter(src: string): string | undefined {
    const opening = /^---[ \t]*(?:\n|$)/.exec(src);
    if (!opening) return undefined;

    let offset = opening[0].length;
    let hasContent = false;
    while (offset < src.length) {
        const nextLineEnd = src.indexOf('\n', offset);
        const lineEnd = nextLineEnd === -1 ? src.length : nextLineEnd + 1;
        const line = src.slice(offset, lineEnd);
        if (/^---[ \t]*(?:\n|$)/.test(line)) {
            return hasContent ? src.slice(0, lineEnd) : undefined;
        }
        if (!/^[ \t]*(?:\n|$)/.test(line)) hasContent = true;
        offset = lineEnd;
    }
    return undefined;
}

function matchDirective(src: string): string | undefined {
    const singleLine = /^(?: {0,3})(?:::[A-Za-z][\w-]*[^\n]*:::[ \t]*|::[A-Za-z][\w-]*[^\n]*)(?:\n|$)/.exec(src);
    if (singleLine) return singleLine[0];

    const opening = /^(?: {0,3}):::[A-Za-z][\w-]*(?:\{[^\n}]*\})?[ \t]*(?:\n|$)/.exec(src);
    if (!opening) return undefined;

    let depth = 1;
    let offset = opening[0].length;
    while (offset < src.length) {
        const nextLineEnd = src.indexOf('\n', offset);
        const lineEnd = nextLineEnd === -1 ? src.length : nextLineEnd + 1;
        const line = src.slice(offset, lineEnd);

        if (/^ {0,3}:::[A-Za-z][\w-]*(?:\{[^\n}]*\})?[ \t]*(?:\n|$)/.test(line)) {
            depth += 1;
        } else if (/^ {0,3}:::[ \t]*(?:\n|$)/.test(line)) {
            depth -= 1;
            if (depth === 0) return src.slice(0, lineEnd);
        }
        offset = lineEnd;
    }
    return undefined;
}

function matchDisplayMath(src: string): string | undefined {
    const singleLine = /^ {0,3}\$\$(?!\$)[^\n]*\$\$[ \t]*(?:\n|$)/.exec(src);
    if (singleLine) return singleLine[0];

    const opening = /^ {0,3}\$\$(?!\$)[^\n]*(?:\n|$)/.exec(src);
    if (!opening) return undefined;

    let offset = opening[0].length;
    while (offset < src.length) {
        const nextLineEnd = src.indexOf('\n', offset);
        const lineEnd = nextLineEnd === -1 ? src.length : nextLineEnd + 1;
        if (/^ {0,3}\$\$[ \t]*(?:\n|$)/.test(src.slice(offset, lineEnd))) {
            return src.slice(0, lineEnd);
        }
        offset = lineEnd;
    }
    return undefined;
}

function matchGithubAlert(src: string): string | undefined {
    if (!/^ {0,3}>[ \t]*\[![A-Z]+\]/.test(src)) return undefined;
    return /^(?: {0,3}>[^\n]*(?:\n|$))+/.exec(src)?.[0];
}

function matchTaskList(src: string): string | undefined {
    if (!/^ {0,3}[-+*][ \t]+\[[ xX]\][ \t]+/.test(src)) return undefined;

    let offset = 0;
    while (offset < src.length) {
        const nextLineEnd = src.indexOf('\n', offset);
        const lineEnd = nextLineEnd === -1 ? src.length : nextLineEnd + 1;
        const line = src.slice(offset, lineEnd);
        const isListItem = /^ {0,3}[-+*][ \t]+/.test(line);
        const isIndentedContinuation = /^(?: {2,}|\t)\S/.test(line);
        const isBlank = /^[ \t]*(?:\n|$)/.test(line);

        if (!isListItem && !isIndentedContinuation && !isBlank) break;
        if (isBlank) {
            const remaining = src.slice(lineEnd);
            if (!/^(?: {0,3}[-+*][ \t]+|(?: {2,}|\t)\S)/.test(remaining)) break;
        }
        offset = lineEnd;
    }

    return offset > 0 ? src.slice(0, offset) : undefined;
}

function matchOpaqueMarkdown(
    src: string,
    atDocumentStart: boolean,
): { kind: OpaqueMarkdownKind; raw: string } | undefined {
    const frontmatter = atDocumentStart ? matchFrontmatter(src) : undefined;
    if (frontmatter) return { kind: 'frontmatter', raw: frontmatter };

    const directive = matchDirective(src);
    if (directive) return { kind: 'directive', raw: directive };

    const displayMath = matchDisplayMath(src);
    if (displayMath) return { kind: 'display-math', raw: displayMath };

    const githubAlert = matchGithubAlert(src);
    if (githubAlert) return { kind: 'github-alert', raw: githubAlert };

    const taskList = matchTaskList(src);
    if (taskList) return { kind: 'task-list', raw: taskList };

    return undefined;
}

function codeBlockNodeView(props: ReactNodeViewProps) {
    const options = props.extension.options as VertesiaCodeBlockOptions;
    const Renderer = options.renderer;
    const language = typeof props.node.attrs.language === 'string' ? props.node.attrs.language : undefined;
    const isWidget = isVertesiaWidgetLanguage(language);

    return (
        <NodeViewWrapper
            className="vertesia-rich-text-code-block"
            data-language={language || undefined}
            data-widget={isWidget || undefined}
        >
            {isWidget && Renderer ? (
                <div className="vertesia-rich-text-widget-preview" contentEditable={false}>
                    <Renderer code={props.node.textContent} language={language} selected={props.selected} />
                </div>
            ) : null}
            <pre className="vertesia-rich-text-code-source">
                <NodeViewContent<'code'> as="code" />
            </pre>
        </NodeViewWrapper>
    );
}

function imageNodeView(props: ReactNodeViewProps) {
    const options = props.extension.options as VertesiaImageOptions;
    const Renderer = options.renderer;
    const src = typeof props.node.attrs.src === 'string' ? props.node.attrs.src : '';
    const alt = typeof props.node.attrs.alt === 'string' ? props.node.attrs.alt : undefined;
    const title = typeof props.node.attrs.title === 'string' ? props.node.attrs.title : undefined;

    return (
        <NodeViewWrapper as="figure" className="vertesia-rich-text-image" data-selected={props.selected || undefined}>
            <div contentEditable={false}>
                {Renderer ? (
                    <Renderer src={src} alt={alt} title={title} selected={props.selected} />
                ) : (
                    <img src={src} alt={alt || ''} title={title} />
                )}
            </div>
        </NodeViewWrapper>
    );
}

function linkMarkView(props: MarkViewProps) {
    const options = props.extension.options as VertesiaLinkOptions;
    const Renderer = options.renderer;
    const href = typeof props.mark.attrs.href === 'string' ? props.mark.attrs.href : '';
    const title = typeof props.mark.attrs.title === 'string' ? props.mark.attrs.title : undefined;
    const content = <MarkViewContent />;

    if (Renderer)
        return (
            <Renderer href={href} title={title}>
                {content}
            </Renderer>
        );
    return (
        <a href={href} title={title} target="_blank" rel="noopener noreferrer">
            {content}
        </a>
    );
}

function opaqueMarkdownNodeView(props: ReactNodeViewProps) {
    const options = props.extension.options as OpaqueMarkdownOptions;
    const Renderer = options.renderer;
    const attrs = props.node.attrs as OpaqueMarkdownAttributes;

    return (
        <NodeViewWrapper
            className="vertesia-rich-text-opaque-block"
            data-kind={attrs.kind}
            data-selected={props.selected || undefined}
        >
            {Renderer ? (
                <div className="vertesia-rich-text-opaque-preview" contentEditable={false}>
                    <Renderer raw={attrs.raw} kind={attrs.kind} selected={props.selected} />
                </div>
            ) : null}
            <pre className="vertesia-rich-text-opaque-source" contentEditable={false}>
                {attrs.raw}
            </pre>
        </NodeViewWrapper>
    );
}

const VertesiaCodeBlock = CodeBlock.extend<VertesiaCodeBlockOptions>({
    addOptions() {
        return { ...this.parent?.(), renderer: undefined } as VertesiaCodeBlockOptions;
    },
    addNodeView() {
        return ReactNodeViewRenderer(codeBlockNodeView, { contentDOMElementTag: 'code' });
    },
});

const VertesiaImage = Image.extend<VertesiaImageOptions>({
    addOptions() {
        return { ...this.parent?.(), renderer: undefined } as VertesiaImageOptions;
    },
    renderMarkdown: (node) => {
        const src = markdownDestination(typeof node.attrs?.src === 'string' ? node.attrs.src : '');
        const alt = markdownLabel(typeof node.attrs?.alt === 'string' ? node.attrs.alt : '');
        const title = typeof node.attrs?.title === 'string' ? node.attrs.title : '';
        return title ? `![${alt}](${src} "${markdownTitle(title)}")` : `![${alt}](${src})`;
    },
    addNodeView() {
        return ReactNodeViewRenderer(imageNodeView);
    },
});

const VertesiaLink = Link.extend<VertesiaLinkOptions>({
    addOptions() {
        return {
            ...this.parent?.(),
            autolink: false,
            linkOnPaste: false,
            openOnClick: false,
            protocols: CUSTOM_PROTOCOLS,
            renderer: undefined,
        } as VertesiaLinkOptions;
    },
    renderMarkdown: (node, helpers) => {
        const href = markdownDestination(typeof node.attrs?.href === 'string' ? node.attrs.href : '');
        const title = typeof node.attrs?.title === 'string' ? node.attrs.title : '';
        const text = helpers.renderChildren(node);
        return title ? `[${text}](${href} "${markdownTitle(title)}")` : `[${text}](${href})`;
    },
    addMarkView() {
        return ReactMarkViewRenderer(linkMarkView, { as: 'span' });
    },
});

export function createVertesiaMarkdownExtensions(options: VertesiaMarkdownKitOptions = {}): Extensions {
    const extensions: Extensions = [
        StarterKit.configure({ codeBlock: false, link: false }),
        VertesiaCodeBlock.configure({ renderer: options.codeBlock }),
        VertesiaImage.configure({ renderer: options.image }),
        VertesiaLink.configure({ renderer: options.link }),
    ];

    if (options.tables !== false) extensions.push(TableKit);
    if (options.opaqueBlocks !== false) extensions.push(createOpaqueMarkdownExtension(options.opaqueBlock));
    extensions.push(Markdown.configure({ marked: createIsolatedMarked(), markedOptions: { gfm: true } }));
    return extensions;
}

function createOpaqueMarkdownExtension(renderer: RichTextRenderers['opaqueBlock']) {
    return Node.create<OpaqueMarkdownOptions>({
        name: 'opaqueMarkdownBlock',
        priority: 1000,
        group: 'block',
        atom: true,
        selectable: true,
        draggable: true,
        addOptions() {
            return { renderer: undefined };
        },
        addAttributes() {
            return {
                kind: { default: 'directive' },
                raw: { default: '' },
            };
        },
        parseHTML() {
            return [{ tag: 'pre[data-opaque-markdown]' }];
        },
        renderHTML({ node }) {
            return ['pre', { 'data-opaque-markdown': node.attrs.kind }, node.attrs.raw];
        },
        markdownTokenName: 'opaqueMarkdownBlock',
        markdownTokenizer: {
            name: 'opaqueMarkdownBlock',
            level: 'block',
            start(src) {
                return src.search(
                    /^ {0,3}(?:---[ \t]*(?:\n|$)|::?::?|\$\$|>[ \t]*\[![A-Z]+\]|[-+*][ \t]+\[[ xX]\][ \t]+)/m,
                );
            },
            tokenize(src, tokens): MarkdownToken | undefined {
                const match = matchOpaqueMarkdown(src, tokens.length === 0);
                if (!match) return undefined;
                return {
                    type: 'opaqueMarkdownBlock',
                    raw: match.raw,
                    opaqueKind: match.kind,
                    rawSource: trimConsumedNewline(match.raw),
                };
            },
        },
        parseMarkdown(token, helpers) {
            return helpers.createNode('opaqueMarkdownBlock', {
                kind: token.opaqueKind,
                raw: token.rawSource,
            });
        },
        renderMarkdown(node) {
            return typeof node.attrs?.raw === 'string' ? node.attrs.raw : '';
        },
        addNodeView() {
            return ReactNodeViewRenderer(opaqueMarkdownNodeView);
        },
    }).configure({ renderer });
}

export function createMarkdownEditor(options: CreateMarkdownEditorOptions = {}): Editor {
    return new Editor({
        extensions: createVertesiaMarkdownExtensions(options),
        content: options.content ?? '',
        contentType: typeof options.content === 'string' || options.content === undefined ? 'markdown' : 'json',
        editable: options.editable ?? true,
    });
}

export function parseMarkdown(markdown: string, options: VertesiaMarkdownKitOptions = {}): JSONContent {
    const editor = createMarkdownEditor({ ...options, content: markdown, editable: false });
    try {
        return editor.getJSON();
    } finally {
        editor.destroy();
    }
}

export function serializeMarkdown(content: JSONContent, options: VertesiaMarkdownKitOptions = {}): string {
    const editor = createMarkdownEditor({ ...options, content, editable: false });
    try {
        return editor.getMarkdown();
    } finally {
        editor.destroy();
    }
}

export function roundTripMarkdown(markdown: string, options: VertesiaMarkdownKitOptions = {}): string {
    return serializeMarkdown(parseMarkdown(markdown, options), options);
}

export type MarkdownCompatibility = 'exact' | 'normalized' | 'lossy';

/**
 * Classifies whether rich-text editing preserves the document structure, even when the serializer
 * canonicalizes equivalent Markdown syntax such as Setext headings or table spacing.
 */
export function getMarkdownCompatibility(
    markdown: string,
    options: VertesiaMarkdownKitOptions = {},
): MarkdownCompatibility {
    try {
        const parsed = parseMarkdown(markdown, options);
        const normalized = serializeMarkdown(parsed, options);
        if (normalized === markdown) return 'exact';

        const reparsed = parseMarkdown(normalized, options);
        const isStructurallyEquivalent = JSON.stringify(reparsed) === JSON.stringify(parsed);
        return isStructurallyEquivalent ? 'normalized' : 'lossy';
    } catch {
        return 'lossy';
    }
}

/**
 * Returns whether opening Markdown in the rich-text editor can preserve its
 * exact source representation. Hosts can use this to warn before entering a
 * full-document editor that normalizes Markdown syntax.
 */
export function isMarkdownSourcePreserving(markdown: string, options: VertesiaMarkdownKitOptions = {}): boolean {
    try {
        return roundTripMarkdown(markdown, options) === markdown;
    } catch {
        return false;
    }
}
