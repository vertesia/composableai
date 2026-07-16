import type { ComponentType, ReactNode } from 'react';

export type OpaqueMarkdownKind = 'directive' | 'display-math' | 'github-alert' | 'task-list';

export interface RichTextCodeBlockRendererProps {
    code: string;
    language?: string;
    selected: boolean;
}

export interface RichTextImageRendererProps {
    src: string;
    alt?: string;
    title?: string;
    selected: boolean;
}

export interface RichTextLinkRendererProps {
    href: string;
    title?: string;
    children: ReactNode;
}

export interface RichTextOpaqueBlockRendererProps {
    raw: string;
    kind: OpaqueMarkdownKind;
    selected: boolean;
}

export interface RichTextRenderers {
    codeBlock?: ComponentType<RichTextCodeBlockRendererProps>;
    image?: ComponentType<RichTextImageRendererProps>;
    link?: ComponentType<RichTextLinkRendererProps>;
    opaqueBlock?: ComponentType<RichTextOpaqueBlockRendererProps>;
}
