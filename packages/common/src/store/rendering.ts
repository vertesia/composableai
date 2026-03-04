/**
 * Rendering API types
 *
 * Types for rendering content to various formats (PDF, DOCX, images)
 */

import { ImageRenditionFormat, MarkdownRenditionFormat } from "./store.js";
import { WorkflowExecutionStatus, WorkflowRunStatus } from "./workflow.js";

// ============================================================================
// Workflow Vars Types (Discriminated Union)
// ============================================================================

/** Base vars shared by all rendition types */
interface BaseRenditionVars {
    mime_type?: string;
    /** Custom upload path — overrides the default renditions/{etag}/{name} path */
    outputPath?: string;
}

/** Workflow vars for image renditions (jpeg, png, webp) */
export interface ImageRenditionVars extends BaseRenditionVars {
    format?: ImageRenditionFormat;
    max_hw?: number;
    max_pages?: number;
}

/** Metadata for PDF rendering (displayed in header/footer) */
export interface PdfRenderingMetadata {
    /** Document ID to display in footer */
    document_id?: string;
    /** Agent name that generated the document */
    agent_name?: string;
    /** Agent run ID to display in footer */
    agent_run_id?: string;
    /** Document subtitle */
    subtitle?: string;
    /** Document author(s) */
    author?: string | string[];
    /** Document date (displayed in header and title page; defaults to today if omitted) */
    date?: string;
}

/** Workflow vars for markdown renditions (pdf, docx) */
export interface MarkdownRenditionVars extends BaseRenditionVars {
    format: MarkdownRenditionFormat;
    /** Inline markdown content (mutually exclusive with objectId) */
    content?: string;
    /** Blob store path to fetch markdown from (mutually exclusive with content/objectId) */
    artifactPath?: string;
    /** Document title for inline content */
    title?: string;
    /** URL to template file (LaTeX for PDF, reference doc for DOCX) */
    templateUrl?: string;
    /** Optional logo URL for template variable `logo-path` (studio-hosted URL) */
    templateLogoUrl?: string;
    /** Template file via artifact:/store: protocol (takes precedence over templateUrl) */
    templatePath?: string;
    /** Logo file via artifact:/store: protocol (takes precedence over templateLogoUrl) */
    logoPath?: string;
    /** Use Vertesia default template if no templateUrl provided (default: true for pdf) */
    useDefaultTemplate?: boolean;
    /** Additional pandoc command-line options */
    pandocOptions?: string[];
    /** Run ID for resolving artifact: URLs in markdown */
    artifactRunId?: string;
    /** Document metadata for PDF footer/header */
    metadata?: PdfRenderingMetadata;
    /** Source reference for auto-wired template data: `store:<objectId>` or `artifact:<path-to-json>` */
    templateDataSource?: string;
}

/** Discriminated union of all rendition workflow vars */
export type GenerateRenditionVars = ImageRenditionVars | MarkdownRenditionVars;

/** Type guard for markdown rendition vars */
export function isMarkdownRenditionVars(
    vars: GenerateRenditionVars
): vars is MarkdownRenditionVars {
    return vars.format === 'pdf' || vars.format === 'docx';
}

// ============================================================================
// API Payload Types
// ============================================================================

/**
 * Payload for rendering markdown to PDF or DOCX.
 * Either object_id OR content must be provided.
 */
export interface RenderMarkdownPayload {
    /** Output format */
    format: MarkdownRenditionFormat;
    /** Object ID to render (mutually exclusive with content) */
    object_id?: string;
    /** Inline markdown content to render (mutually exclusive with object_id) */
    content?: string;
    /** Document title (used for filename when using inline content) */
    title?: string;
    /** URL to a template file for pandoc (DOCX reference doc or LaTeX template) */
    template_url?: string;
    /** Optional logo URL for template variable `logo-path` (studio-hosted URL) */
    template_logo_url?: string;
    /** Template file via artifact:/store: protocol (takes precedence over template_url) */
    template_path?: string;
    /** Logo file via artifact:/store: protocol (takes precedence over template_logo_url) */
    logo_path?: string;
    /** Use Vertesia default template if no template_url provided (default: true for pdf) */
    use_default_template?: boolean;
    /** Additional pandoc command-line options */
    pandoc_options?: string[];
    /** Run ID for resolving artifact: and image: URLs */
    artifact_run_id?: string;
    /** Document metadata for PDF footer/header */
    metadata?: PdfRenderingMetadata;
    /** Source reference for auto-wired template data: `store:<objectId>` or `artifact:<path-to-json>` */
    template_data_source?: string;
    /** Custom upload path for the rendered output */
    output_path?: string;
}

/**
 * Initial response when starting a markdown rendering workflow.
 * Clients should poll status using workflow_id/workflow_run_id.
 */
export interface RenderMarkdownStartResponse extends WorkflowRunStatus {
    /** Requested output format */
    format: MarkdownRenditionFormat;
}

/**
 * Polled status response for markdown rendering workflow.
 */
export interface RenderMarkdownStatusResponse extends WorkflowRunStatus {
    /** Requested output format (if known) */
    format?: MarkdownRenditionFormat;
    /** Download URL for completed output */
    download_url?: string;
    /** File URI in storage for completed output */
    file_uri?: string;
    /** Error details for failed/terminated runs */
    error?: string;
}

/**
 * Client-side polling options for markdown rendering.
 */
export interface RenderMarkdownPollOptions {
    /** Maximum time to wait in milliseconds (default: 10 minutes) */
    timeoutMs?: number;
    /** Polling interval in milliseconds (default: 1500ms) */
    pollIntervalMs?: number;
}

/**
 * Result from the GenerateRenditions workflow.
 * Shared between zeno-server (consumer) and workflows (producer).
 */
export interface GenerateRenditionsResult {
    uploads: string[];
    format: string;
    status: string;
    fileUri?: string;
    /** Warnings about rich content blocks that failed to render (document was still produced) */
    warnings?: string[];
}

/**
 * Response from the rendering API.
 */
export interface RenderMarkdownResponse {
    /** Rendering status */
    status: "success";
    /** Output format */
    format: MarkdownRenditionFormat;
    /** Download URL for the rendered document */
    download_url?: string;
    /** File URI in storage */
    file_uri?: string;
}

// ============================================================================
// Slide Deck Types
// ============================================================================

/** A slide rendered from a named SVG template with structured content */
export interface TemplateSlide {
    type: 'template';
    /** Template name: 'title' | 'section' | 'bullets' | 'two-column' | 'image-text' */
    template: string;
    /** Key-value content for the template (values can be strings or string arrays) */
    content: Record<string, string | string[]>;
}

/** A slide with raw SVG markup */
export interface RawSvgSlide {
    type: 'svg';
    /** Complete SVG markup (should use 1920x1080 viewBox) */
    svg: string;
}

/** A single slide specification — either template-based or raw SVG */
export type SlideSpec = TemplateSlide | RawSvgSlide;

/** Options for rendering a slide deck to PDF */
export interface RenderSlidesDeckOptions {
    /** Canvas scale factor for higher resolution (default: 2) */
    scale?: number;
    /** Background color for each slide (default: '#ffffff') */
    backgroundColor?: string;
    /** Slide theme — replaces default colors in SVG templates */
    theme?: Record<string, string>;
}

/** Result of rendering a slide deck to PDF */
export interface RenderSlidesDeckResult {
    /** PDF file as a Uint8Array (use Buffer.from() in Node.js) */
    buffer: Uint8Array;
    /** Number of slides rendered */
    slideCount: number;
    /** PDF page width in points (720 = 10") */
    pageWidth: number;
    /** PDF page height in points (540 = 7.5") */
    pageHeight: number;
}

export function isWorkflowTerminalStatus(status: WorkflowExecutionStatus): boolean {
    return status === WorkflowExecutionStatus.COMPLETED
        || status === WorkflowExecutionStatus.FAILED
        || status === WorkflowExecutionStatus.CANCELED
        || status === WorkflowExecutionStatus.TERMINATED
        || status === WorkflowExecutionStatus.TIMED_OUT;
}
