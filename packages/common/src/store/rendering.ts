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
    documentId?: string;
    /** Agent name that generated the document */
    agentName?: string;
    /** Agent run ID to display in footer */
    agentRunId?: string;
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
    /** Use Vertesia default template if no templateUrl provided (default: true for pdf) */
    useDefaultTemplate?: boolean;
    /** Additional pandoc command-line options */
    pandocOptions?: string[];
    /** Run ID for resolving artifact: URLs in markdown */
    artifactRunId?: string;
    /** Document metadata for PDF footer/header */
    metadata?: PdfRenderingMetadata;
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
 * Either objectId OR content must be provided.
 */
export interface RenderMarkdownPayload {
    /** Output format */
    format: MarkdownRenditionFormat;
    /** Object ID to render (mutually exclusive with content) */
    objectId?: string;
    /** Inline markdown content to render (mutually exclusive with objectId) */
    content?: string;
    /** Document title (used for filename when using inline content) */
    title?: string;
    /** URL to a template file for pandoc (DOCX reference doc or LaTeX template) */
    templateUrl?: string;
    /** Use Vertesia default template if no templateUrl provided (default: true for pdf) */
    useDefaultTemplate?: boolean;
    /** Additional pandoc command-line options */
    pandocOptions?: string[];
    /** Run ID for resolving artifact: and image: URLs */
    artifactRunId?: string;
    /** Document metadata for PDF footer/header */
    metadata?: PdfRenderingMetadata;
    /** Custom upload path for the rendered output */
    outputPath?: string;
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
    downloadUrl?: string;
    /** File URI in storage for completed output */
    fileUri?: string;
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
    downloadUrl?: string;
    /** File URI in storage */
    fileUri?: string;
}

export function isWorkflowTerminalStatus(status: WorkflowExecutionStatus): boolean {
    return status === WorkflowExecutionStatus.COMPLETED
        || status === WorkflowExecutionStatus.FAILED
        || status === WorkflowExecutionStatus.CANCELED
        || status === WorkflowExecutionStatus.TERMINATED
        || status === WorkflowExecutionStatus.TIMED_OUT;
}
