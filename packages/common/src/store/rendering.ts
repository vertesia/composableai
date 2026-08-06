/**
 * Rendering API types
 *
 * Types for rendering content to various formats (PDF, DOCX, images)
 */

import type { z } from 'zod';
import type {
    PdfRenderingMetadataSchema,
    RenderMarkdownPayloadSchema,
    RenderMarkdownStartResponseSchema,
    RenderMarkdownStatusQuerySchema,
    RenderMarkdownStatusResponseSchema,
} from '../api-schemas/document-processing.js';
import type { ImageRenditionFormat, MarkdownRenditionFormat } from './store.js';
import { WorkflowExecutionStatus } from './workflow.js';

// ============================================================================
// Workflow Vars Types (Discriminated Union)
// ============================================================================

/** Base vars shared by all rendition types */
interface BaseRenditionVars extends Record<string, unknown> {
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

interface ImageRenditionParams {
    max_hw: number;
    format: ImageRenditionFormat;
    outputPath?: string;
}

export function getRenditionsPath(contentEtag: string, params: ImageRenditionParams) {
    return `renditions/${contentEtag}/${params.max_hw}`;
}

/** Metadata for PDF rendering, inferred from the published API schema. */
export type PdfRenderingMetadata = z.infer<typeof PdfRenderingMetadataSchema>;

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
export function isMarkdownRenditionVars(vars: GenerateRenditionVars): vars is MarkdownRenditionVars {
    return vars.format === 'pdf' || vars.format === 'docx';
}

// ============================================================================
// API Payload Types
// ============================================================================

/**
 * Payload for rendering markdown to PDF or DOCX.
 * Either object_id OR content must be provided.
 */
export type RenderMarkdownPayload = z.infer<typeof RenderMarkdownPayloadSchema>;

/**
 * Initial response when starting a markdown rendering workflow.
 * Clients should poll status using workflow_id/workflow_run_id.
 */
export type RenderMarkdownStartResponse = z.infer<typeof RenderMarkdownStartResponseSchema>;

/**
 * Polled status response for markdown rendering workflow.
 */
export type RenderMarkdownStatusResponse = z.infer<typeof RenderMarkdownStatusResponseSchema>;

export type RenderMarkdownStatusQuery = z.infer<typeof RenderMarkdownStatusQuerySchema>;

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
    status: 'success';
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
interface TemplateSlide {
    type: 'template';
    /** Template name: 'title' | 'section' | 'bullets' | 'two-column' | 'image-text' */
    template: string;
    /** Key-value content for the template (values can be strings or string arrays) */
    content: Record<string, string | string[]>;
}

/** A slide with raw SVG markup */
interface RawSvgSlide {
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
    return (
        status === WorkflowExecutionStatus.COMPLETED ||
        status === WorkflowExecutionStatus.FAILED ||
        status === WorkflowExecutionStatus.CANCELED ||
        status === WorkflowExecutionStatus.TERMINATED ||
        status === WorkflowExecutionStatus.TIMED_OUT
    );
}
