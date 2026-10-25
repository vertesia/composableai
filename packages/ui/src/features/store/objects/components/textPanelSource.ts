import type { ContentObject, DocumentMetadata } from '@vertesia/common';
import type { UniversalDocumentSource } from '../../../document-viewer/UniversalDocumentViewer.js';
import { isDocumentEditingContentType } from './documentEditingRun.js';

/**
 * Check if text content appears to be markdown based on common patterns.
 */
export function looksLikeMarkdown(text: string | undefined): boolean {
    if (!text) return false;
    return (
        text.includes('\n# ') ||
        text.includes('\n## ') ||
        text.includes('\n### ') ||
        text.includes('\n* ') ||
        text.includes('\n- ') ||
        text.includes('\n+ ') ||
        text.includes('![') ||
        text.includes('](')
    );
}

function isTextualContentType(contentType: string | undefined): boolean {
    return !!contentType && (contentType.startsWith('text/') || contentType.startsWith('application/json'));
}

/**
 * Build the document-viewer source for the Text panel, which renders the object's extracted text.
 * For binary content (image/png, application/pdf, ...) the text is rendered as markdown, and the
 * source must not carry the content's MIME type or path: the viewer would resolve the file and
 * render it instead of the text.
 */
export function getTextPanelSource(object: ContentObject, text: string | undefined): UniversalDocumentSource {
    const content = object.content;
    const contentProcessorType = (object.metadata as DocumentMetadata | undefined)?.content_processor?.type;
    const isXml = contentProcessorType === 'xml' || content?.type === 'application/xml' || content?.type === 'text/xml';
    const isTextual = isXml || isTextualContentType(content?.type);
    // Render as markdown for binary or markdown/text content, or text that looks like markdown (but not XML)
    const shouldRenderAsMarkdown =
        !isXml && (!isTextual || isDocumentEditingContentType(content?.type) || looksLikeMarkdown(text));

    let contentType: string | undefined;
    if (isXml) {
        contentType = 'text/xml';
    } else if (shouldRenderAsMarkdown) {
        contentType = 'text/markdown';
    } else {
        contentType = content?.type;
    }

    return {
        id: object.id,
        title: object.name,
        fileName: content?.name || object.name,
        contentType,
        content: text,
        sourcePath: isTextual ? content?.source : undefined,
    };
}
