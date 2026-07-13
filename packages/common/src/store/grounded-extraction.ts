import type { InteractionExecutionConfiguration } from '../interaction.js';
import type { WorkflowRunStatus } from './workflow.js';

/**
 * Document-level trust verdict for a grounded extraction. `good_to_go` means the
 * extracted content (after any review corrections) can be used without a human
 * check; `needs_review` means a human should verify it. This reflects content
 * correctness, not how many citation boxes rendered.
 */
export type GroundedExtractionVerdict = 'good_to_go' | 'needs_review';

/**
 * Canonical workflow id for object-scoped grounded extraction. Every entry point
 * must use this id so Temporal prevents overlapping extraction runs per object.
 */
export function getGroundedExtractionWorkflowId(accountId: string, objectId: string): string {
    return `${accountId.slice(0, 6)}:workflow_execution_request:${objectId}:grounded`;
}

/**
 * Request body to start a grounded extraction on a content object. All fields are
 * optional: with none set, the object's own content-type schema drives the
 * extraction with default models and settings.
 */
export interface GroundedExtractionRequest {
    /** JSON schema describing the data to extract. Takes precedence over type_ref. */
    schema?: Record<string, unknown>;
    /** Content type id or catalog ref whose object_schema drives the extraction. */
    type_ref?: string;
    /** Interaction to use. Defaults to sys:ExtractInformationGrounded. */
    interaction_name?: string;
    /** Maximum number of pages to process. */
    max_pages?: number;
    /** Run OCR on every page even when a text layer exists. */
    force_ocr?: boolean;
    /** Re-run OCR on pages that need it instead of restoring the stored OCR result. */
    refresh_ocr?: boolean;
    /** Attach page images to the extraction prompt so hard pages can be read visually. */
    use_vision?: boolean;
    /**
     * A1 locate-grid cell size in PDF points for vision pages (drives both the drawn
     * grid and cell→box resolution). Smaller = finer grid / more cells (10 ≈ half the
     * default). Default: 20.
     */
    grid_cell_pt?: number;
    /**
     * How to read pages that have no digital text layer (scans / image-only pages).
     * 'vision' (default): read them off the page image with the extraction model,
     * skipping OCR entirely. 'ocr': legacy path — OCR those pages and block-ground on
     * the (lossy) OCR text. Set to 'ocr' to revert to the pre-vision behavior.
     */
    raster_mode?: 'vision' | 'ocr';
    /** Maximum pages per extraction call; larger documents are split into sequential windows. */
    window_pages?: number;
    /**
     * Extract with an autonomous agent (views the whole document at once) instead of
     * the deterministic windowed pipeline. Sidesteps window-boundary splits on long
     * documents. The workflow stages the artifacts into an agent space, runs a
     * conversation agent that writes the extraction, then folds it back.
     */
    agentic_extraction?: boolean;
    /** Agent interaction for agentic_extraction. Defaults to sys:GeneralAgent. */
    extract_agent?: string;
    /** Update the object's properties with the extracted data. Default: true. */
    update_properties?: boolean;
    /** LLM execution configuration (model, environment, ...) for the main pass. */
    config?: InteractionExecutionConfiguration;
    /** Execution configuration used instead of `config` on hard content (scans, handwriting). */
    hard_config?: InteractionExecutionConfiguration;
    /** Hardness score (0..1) at or above which `hard_config` is used. Default: 0.5. */
    hardness_threshold?: number;
    /** Execution configuration for the post-extraction review pass. No review runs when absent. */
    review_config?: InteractionExecutionConfiguration;
    /** Hardness score (0..1) at or above which the review runs. Defaults to hardness_threshold. */
    review_threshold?: number;
    /** Review triggers when any page's citation coverage falls below this floor. Default: 0.2. */
    coverage_review_threshold?: number;
    /** Run the model review even when every citation was digitally verified. Requires review_config. */
    force_review?: boolean;
}

/**
 * Status of a grounded extraction workflow. Carries the doc-level verdict once the
 * run has completed and written its result.
 */
export interface GroundedExtractionRunStatusResponse extends WorkflowRunStatus {
    /** The trust verdict, present once the run has completed. */
    verdict?: GroundedExtractionVerdict;
}

/**
 * How each extracted value was verified. Two kinds, both trustworthy:
 * digitally verified (matched the document's text — digital layer or OCR) and
 * AI verified (the reviewer confirmed it against the page image — the primary
 * signal for scanned or handwritten content, which has no text layer to match).
 */
export interface GroundedVerificationBreakdown {
    /** Total number of cited values. */
    total: number;
    /** Values matched verbatim against the document's text (digital layer or OCR). */
    digitally_verified: number;
    /** Values the reviewer model confirmed against the page image. */
    ai_verified: number;
    /** Values read from the image but neither text-matched nor reviewer-confirmed. */
    unverified: number;
}

/**
 * Completed grounded extraction result: the extracted data with its trust verdict
 * and verification breakdown, plus a download URL for the full citations artifact.
 */
export interface GroundedExtractionResultResponse {
    object_id: string;
    /** The extracted data, shaped by the requested schema. */
    data: Record<string, unknown>;
    /** Document-level trust verdict. */
    verdict?: GroundedExtractionVerdict;
    /** One-sentence rationale for the verdict. */
    verdict_reason?: string;
    /** Mean citation confidence in [0,1]. */
    confidence?: number;
    /** Per-value verification breakdown. */
    verification: GroundedVerificationBreakdown;
    /** Review outcome, when a review pass ran. */
    review?: {
        assessment: 'complete' | 'issues_found';
        summary?: string;
        corrections_applied?: number;
    };
    /** Signed download URL for the full grounded-extraction.json (data + citations + boxes). */
    result_url?: string | null;
}
