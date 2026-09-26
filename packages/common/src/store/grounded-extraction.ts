import type * as Wire from '../wire-types.generated.js';

/**
 * Document-level trust verdict for a grounded extraction. `good_to_go` means the
 * extracted content (after any review corrections) can be used without a human
 * check; `needs_review` means a human should verify it. This reflects content
 * correctness, not how many citation boxes rendered.
 */
export type GroundedExtractionVerdict = Wire.GroundedExtractionVerdict;

/**
 * Request body to start a grounded extraction on a content object. All fields are
 * optional: with none set, the object's own content-type schema drives the
 * extraction with default models and settings.
 */
export type GroundedExtractionRequest = Wire.GroundedExtractionRequest;

/**
 * Response from starting the interactive grounded extraction assistant. The agent
 * run + conversation workflow are launched server-side (recordRun -> stage the
 * document into the agent space -> launch the interactive conversation); the
 * client renders the conversation with `agent_run_id`.
 */
export type GroundedAssistantResponse = Wire.GroundedAssistantResponse;

/**
 * How each extracted value was verified. Two kinds, both trustworthy:
 * digitally verified (matched the document's text — digital layer or OCR) and
 * AI verified (the reviewer confirmed it against the page image — the primary
 * signal for scanned or handwritten content, which has no text layer to match).
 */
export type GroundedVerificationBreakdown = Wire.GroundedVerificationBreakdown;

/**
 * Completed grounded extraction result: the extracted data with its trust verdict
 * and verification breakdown, plus a download URL for the full citations artifact.
 */
export type GroundedExtractionResultResponse = Wire.GroundedExtractionResultResponse;
