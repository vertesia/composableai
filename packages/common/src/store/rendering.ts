/**
 * Rendering API types
 *
 * Types for rendering content to various formats (PDF, DOCX)
 */

/**
 * Payload for rendering markdown to PDF or DOCX
 */
export interface RenderMarkdownPayload {
    /**
     * Inline markdown content
     */
    content?: string;
    /**
     * Object ID to fetch markdown content from
     * The object's content.source will be downloaded and used
     */
    objectId?: string;
    /** Output format */
    format: 'pdf' | 'docx';
    /** Optional title for the document (defaults to object name if objectId is used) */
    title?: string;
    /** Optional run ID for resolving artifact: URLs in the markdown */
    artifactRunId?: string;
    /**
     * Optional template URL for pandoc
     * - For PDF: LaTeX template (.latex, .tex)
     * - For DOCX: Reference document (.docx)
     * Supports http(s):// and cloud storage URLs (gs://, s3://)
     */
    templateUrl?: string;
    /**
     * Optional additional pandoc command-line options
     * Example: ["--toc", "--number-sections", "--highlight-style=tango"]
     */
    pandocOptions?: string[];
}
