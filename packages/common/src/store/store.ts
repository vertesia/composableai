import type { JSONSchemaType } from 'ajv';
import type { ComputedFacetResponse } from '../facets.js';
import type { InteractionExecutionConfiguration } from '../interaction.js';
import type { JSONObject } from '../json.js';
import type { SearchPayload } from '../payload.js';
import type { SupportedEmbeddingTypes } from '../project.js';
import type { ComplexSearchQuery } from '../query.js';
import type { BaseObject } from './common.js';

export enum ContentObjectApiHeaders {
    COLLECTION_ID = 'x-collection-id',
    PROCESSING_PRIORITY = 'x-processing-priority',
    CREATE_REVISION = 'x-create-revision',
    REVISION_LABEL = 'x-revision-label',
    /**
     * @deprecated Events are now always emitted. This suppresses the Temporal-backed delivery targets (workflow, agent, and process) — webhook deliveries still fire.
     */
    SUPPRESS_WORKFLOWS = 'x-suppress-workflows',
}

export interface CreateContentObjectQuery {
    collection_id?: string;
    processing_priority?: ContentObjectProcessingPriority;
}

export interface CreateContentObjectHeaders {
    'x-collection-id'?: string;
    'x-processing-priority'?: ContentObjectProcessingPriority;
}

export interface UpdateContentObjectQuery {
    create_revision?: boolean;
    revision_label?: string;
    processing_priority?: ContentObjectProcessingPriority;
}

export interface UpdateContentObjectHeaders {
    'if-match'?: string;
    'x-create-revision'?: boolean;
    'x-revision-label'?: string;
    'x-processing-priority'?: ContentObjectProcessingPriority;
    /**
     * @deprecated Events are now always emitted. This suppresses the Temporal-backed delivery targets (workflow, agent, and process) — webhook deliveries still fire.
     */
    'x-suppress-workflows'?: boolean;
}

export interface GetObjectRenditionQuery {
    block_on_generation?: boolean;
    generate_if_missing?: boolean;
    max_hw?: number;
    sign_url?: boolean;
}

/**
 * Headers for Data Store API calls.
 * Used for Cloud Run session affinity to route requests to the same instance.
 */
export enum DataStoreApiHeaders {
    /** Data store ID for session affinity - routes requests for same store to same instance */
    DATA_STORE_ID = 'x-data-store-id',
}

export enum ContentObjectStatus {
    created = 'created',
    processing = 'processing', // the was created and still processing
    ready = 'ready', // the object is rendered and ready to be used
    completed = 'completed',
    failed = 'failed',
    archived = 'archived',
}

export interface Embedding {
    model: string; //the model used to generate this embedding
    values: number[];
    etag?: string; // the etag of the text used for the embedding
}

/**
 * Optional object context to include in content object export rows.
 */
export interface ExportContentObjectsIncludeOptions {
    /**
     * Include stored embeddings. Disabled by default for generic object exports.
     */
    embeddings?: boolean;
    /**
     * Include content source metadata. Enabled by default.
     */
    content?: boolean;
    /**
     * Include object lifecycle status. Enabled by default.
     */
    status?: boolean;
    /**
     * Include object properties. Enabled by default.
     */
    properties?: boolean;
    /**
     * Include technical object metadata. Disabled by default because metadata may be large.
     */
    metadata?: boolean;
    /**
     * Include object revision details. Enabled by default.
     */
    revision?: boolean;
}

/**
 * Bounded filters supported by the bulk content object export API.
 */
export interface ExportContentObjectsFilter {
    types?: string[];
    created_from?: string;
    created_to?: string;
    updated_from?: string;
    updated_to?: string;
}

/**
 * Exported object identity and context for a single content object row.
 */
export interface ExportedContentObjectRecord {
    id: string;
    name: string;
    location: string;
    external_id?: string;
    type?: {
        ref_type?: 'stored' | 'incode' | 'untyped';
        id?: string;
        code?: string;
        name?: string;
    };
    status?: ContentObjectStatus;
    content?: {
        source?: string;
        type?: string;
        name?: string;
        etag?: string;
    };
    created_at: string;
    updated_at: string;
    revision?: RevisionInfo;
    properties?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    embeddings?: Partial<Record<SupportedEmbeddingTypes, Embedding>>;
}

export interface StartContentObjectExportRequest {
    /**
     * Embedding types to export when include.embeddings is true. Defaults to all supported embedding types.
     */
    embedding_types?: SupportedEmbeddingTypes[];
    /**
     * Explicit export filters. This intentionally does not accept the search API's full Mongo/search DSL.
     */
    filter?: ExportContentObjectsFilter;
    /**
     * Include all revisions. Defaults to false, exporting only head revisions.
     */
    all_revisions?: boolean;
    /**
     * Optional object context selectors.
     */
    include?: ExportContentObjectsIncludeOptions;
    /**
     * Compress the export with gzip. Defaults to true.
     */
    compression?: boolean;
}

export interface StartContentObjectExportResponse {
    workflow_id: string;
    run_id: string;
    export_id: string;
}

export interface ZenoBulkContentObjectExportRequest extends Omit<StartContentObjectExportRequest, 'compression'> {
    tenant_id: string;
    project_id: string;
    export_id: string;
    output_path: string;
    filename: string;
    manifest_path: string;
    manifest_filename: string;
    compression: boolean;
}

export interface ZenoBulkContentObjectExportShardRange {
    min_id?: string;
    max_id?: string;
}

export interface ZenoBulkContentObjectExportPlanRequest extends ZenoBulkContentObjectExportRequest {
    target_shard_records?: number;
    max_shards?: number;
}

export interface ZenoBulkContentObjectExportPlanResponse {
    shards: ZenoBulkContentObjectExportShardRange[];
}

export interface ZenoBulkContentObjectExportShardRequest extends ZenoBulkContentObjectExportRequest {
    shard_index: number;
    shard_count: number;
    shard: ZenoBulkContentObjectExportShardRange;
}

export interface ZenoBulkContentObjectExportSplitShardRequest extends ZenoBulkContentObjectExportRequest {
    shard: ZenoBulkContentObjectExportShardRange;
    min_split_records?: number;
}

export interface ZenoBulkContentObjectExportSplitShardResponse {
    shards: ZenoBulkContentObjectExportShardRange[];
    splittable: boolean;
    records: number;
}

export interface ZenoBulkContentObjectExportShardResult {
    status: 'completed';
    shard_index: number;
    shard_count: number;
    path: string;
    filename: string;
    content_type: string;
    records: number;
    bytes: number;
    started_at: string;
    completed_at: string;
    duration_ms: number;
}

export interface ZenoBulkContentObjectExportComposeRequest extends ZenoBulkContentObjectExportRequest {
    parts: string[];
    records?: number;
    /**
     * Export workflow start timestamp. Used to report end-to-end duration after final compose.
     */
    started_at?: string;
}

export interface ContentObjectExportResult {
    status: 'completed';
    path: string;
    filename: string;
    content_type: string;
    manifest_path?: string;
    manifest_filename?: string;
    manifest_content_type?: string;
    manifest_bytes?: number;
    records: number;
    bytes: number;
    started_at: string;
    completed_at: string;
    duration_ms: number;
}

export interface ContentObjectExportProgress {
    status: 'queued' | 'planning' | 'exporting' | 'composing' | 'completed' | 'failed';
    records: number;
    bytes: number;
    path?: string;
    filename?: string;
    completed_shards?: number;
    total_shards?: number;
    started_at?: string;
    completed_at?: string;
    error?: string;
}

export interface ContentObjectExportStatusResponse {
    workflow_id: string;
    run_id: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'terminated' | 'timed_out' | 'unknown';
    done: boolean;
    progress?: ContentObjectExportProgress;
    result?: ContentObjectExportResult;
    error?: string;
}

export interface ContentObjectExportArtifact {
    export_id: string;
    path: string;
    filename: string;
    content_type: string;
    bytes: number;
    created_at?: string;
    files?: ContentObjectExportArtifactFile[];
}

export interface ContentObjectExportArtifactFile {
    role: 'data' | 'manifest';
    path: string;
    filename: string;
    content_type: string;
    bytes: number;
}

export interface ListContentObjectExportsResponse {
    items: ContentObjectExportArtifact[];
    limit: number;
}

export interface DeleteContentObjectExportResponse {
    success: boolean;
    export_id: string;
    path: string;
}

/**
 * Metadata about a single inherited property.
 */
export interface InheritedPropertyMetadata {
    /** The property name that was inherited */
    name: string;
    /** The collection ID that provided this property */
    collection: string;
}
/**
 * Computed per-request permissions for the current user on a content object.
 * Not stored in the database — computed on the fly by the API from the object's security field.
 */
export interface ContentObjectUserPermissions {
    can_write: boolean;
    can_delete: boolean;
}

export interface ContentObjectTextResponse {
    text?: string;
}

export interface DeleteContentObjectResult {
    id: string;
    count: number;
}

export interface SetObjectEmbeddingsResponse {
    type?: Embedding;
}

export type ContentObjectApiTypeRef = ContentObjectTypeRef;

export interface ContentObjectApiRevision {
    parent?: string;
    root: string;
    head: boolean;
    label?: string;
}

export interface ContentObjectItemApiResponse extends BaseObject {
    parent?: string;
    location: string;
    status: ContentObjectStatus;
    type?: ContentObjectApiTypeRef;
    content?: ContentSource;
    external_id?: string;
    properties: JSONObject;
    metadata?: Record<string, unknown>;
    tokens?: {
        count?: number;
        encoding?: string;
        etag?: string;
    };
    revision: ContentObjectApiRevision;
    is_deleted?: boolean;
    is_locked?: boolean;
    score?: number;
    user_permissions?: ContentObjectUserPermissions;
}

export interface ContentObjectApiResponse extends ContentObjectItemApiResponse {
    text?: string;
    text_etag?: string;
    embeddings?: Record<string, Embedding>;
    parts?: string[];
    parts_etag?: string;
    transcript?: Record<string, unknown>;
    security?: Record<string, string[]>;
    inherited_properties?: InheritedPropertyMetadata[];
}

export interface ContentObject<T = JSONObject> extends ContentObjectItem<T> {
    text?: string; // the text representation of the object
    text_etag?: string;
    embeddings: Partial<Record<SupportedEmbeddingTypes, Embedding>>;
    parts?: string[]; // the list of objectId of the parts of the object
    parts_etag?: string; // the etag of the text used for the parts list
    transcript?: Transcript;
    security?: Record<string, string[]>; // Security field for granular permissions
    /** BLP sensitivity level — set directly or inherited from collections (max across collections). */
    sensitivity?: number;
    /** Compartments — set directly or inherited from collections (union across collections). */
    compartments?: string[];

    /**
     * Inherited properties metadata - tracks which properties were inherited from parent collections.
     * Used to display readonly inherited properties in the UI and enable incremental sync optimization.
     */
    inherited_properties?: InheritedPropertyMetadata[];
}

export enum ContentNature {
    Video = 'video',
    Image = 'image',
    Audio = 'audio',
    Document = 'document',
    Code = 'code',
    Other = 'other',
}

export interface Dimensions {
    width: number;
    height: number;
}

export interface Location {
    latitude: number;
    longitude: number;
}

export interface GenerationRunMetadata {
    id: string;
    date: string;
    model: string;
    target?: string;
    /**
     * Fingerprint of the inputs used by property extraction (content etag, type + its object
     * schema, source, instructions, interaction). Lets a later run skip re-extraction when
     * nothing changed.
     */
    extraction_fingerprint?: string;
}

// Base rendition interface for document and audio
export interface Rendition {
    name: string;
    content: ContentSource;
}

// Rendition with dimensions for video and image
export interface RenditionWithDimensions extends Rendition {
    dimensions: Dimensions;
}

export const POSTER_RENDITION_NAME = 'Poster';
export const AUDIO_RENDITION_NAME = 'Audio';
export const WEB_VIDEO_RENDITION_NAME = 'Web';
export const PDF_RENDITION_NAME = 'PDF';

export interface ContentMetadata {
    // Common fields for all media types
    type?: ContentNature;
    size?: number; // in bytes
    languages?: string[];
    location?: Location;
    generation_runs?: GenerationRunMetadata[];
    etag?: string;
    /** ETag of text materialized from object properties by intake rendering. */
    rendered_text_etag?: string;
    renditions?: Rendition[];
    /**
     * Embedded/technical metadata harvested from the source file by intake
     * (office docProps, PDF docinfo). Free-form, nature-appropriate keys.
     */
    embedded?: Record<string, unknown>;
    /** Type-detection provenance recorded by the intake sniff pipeline. */
    type_detection?: TypeDetectionMetadata;
    /** Locate-pass provenance: which pages the document map found relevant. */
    locate?: LocateMetadata;
    /** Vision-evidence provenance for the last visual extraction run. */
    vision_evidence?: VisionEvidenceMetadata;
}

/**
 * Provenance persisted at `metadata.locate` when the intake locate (document-map) pass runs.
 * The page list doubles as navigation metadata for the UI.
 */
export interface LocateMetadata {
    /** Relevant pages proposed by the locate pass, in plan-ranked order (1-based). */
    pages: number[];
    /** Detail profile the plan requested for visual extraction. */
    visual_detail?: 'low' | 'standard' | 'high';
    /** Whether the plan asked for color rendering. */
    needs_color?: boolean;
    /** The model's one-line explanation of the selection. */
    reason?: string;
    page_count?: number;
    /** Pages per contact sheet used for the pass (8 or 16). */
    detail?: number;
    sheet_count?: number;
    located_at: string;
}

/**
 * Provenance persisted at `metadata.vision_evidence` whenever intake prepares scoped page
 * images for visual extraction (design: vision evidence spec — dropped pages are recorded,
 * never silently batched).
 */
export interface VisionEvidenceMetadata {
    /** Extraction source that requested the evidence. */
    source_requested?: 'auto' | 'text' | 'vision' | 'mixed';
    /** Pages rendered and sent as evidence, in ranked order (1-based). */
    pages_sent: number[];
    /** Resolved detail profile name. */
    detail: 'low' | 'standard' | 'high';
    /** Candidate pages dropped by budget clamping (recorded, not batched). */
    dropped_pages?: number[];
    /** The locate plan's reason, when the plan drove the page selection. */
    plan_reason?: string;
    /** Which clamps fired (page_count, allowed_details, token budget, page caps, payload). */
    clamps_applied?: string[];
    /** Estimated image tokens for the pages sent. */
    est_tokens?: number;
    page_count?: number;
    prepared_at: string;
}

/**
 * Durable provenance persisted at `metadata.type_detection` whenever the intake sniff pipeline
 * runs. `method` records which mechanism decides the type: the sniff itself (high confidence),
 * the post-conversion selector (medium/low/other), or the post-conversion selector because the
 * document was below the small-doc page threshold.
 */
export interface TypeDetectionMetadata {
    method: 'sniff' | 'post_conversion' | 'post_conversion_small_doc';
    /** Sniffed type id, or 'other'. */
    type?: string;
    type_name?: string;
    /** Sniff confidence, 0..1. */
    confidence?: number;
    band?: 'high' | 'medium' | 'low';
    rationale?: string;
    alternates?: string[];
    /** Which evidence kinds the sniff saw. */
    evidence?: 'text' | 'image' | 'both';
    page_count?: number;
    /** Why the sniff LLM call was skipped (e.g. 'below_min_pages'). */
    skipped_reason?: string;
    min_pages?: number;
    detected_at: string;
}

// Type-specific metadata interfaces
export interface TemporalMediaMetadata extends ContentMetadata {
    duration?: number; // in seconds
    transcript?: Transcript;
}

export interface ImageMetadata extends ContentMetadata {
    type: ContentNature.Image;
    dimensions?: Dimensions;
    renditions?: RenditionWithDimensions[];
}

export interface AudioMetadata extends TemporalMediaMetadata {
    type: ContentNature.Audio;
}

export interface VideoMetadata extends TemporalMediaMetadata {
    type: ContentNature.Video;
    dimensions?: Dimensions;
    renditions?: RenditionWithDimensions[];
    hasAudio?: boolean;
}

export interface TextSection {
    description: string; // the description of the section
    first_line_index: number;
    last_line_index: number;
}

export interface DocumentMetadata extends ContentMetadata {
    type: ContentNature.Document;
    page_count?: number;
    content_processor?: {
        type?: string;
        features_requested?: string[];
        zones_requested?: string[];
        table_count?: number;
        image_count?: number;
        zone_count?: number;
        needs_ocr_count?: number;
        /** Fingerprint of source+policy used for custom conversion, to skip re-converting unchanged docs. */
        conversion_fingerprint?: string;
    };
    /**
     * Grounded-extraction trust signal + key data. Written by the grounded pipeline
     * (verdict, confidence, citation counts, review status, source etag, ...) and
     * queryable for list/filter. Open-ended so more grounded key-data can be stored
     * without a type change.
     */
    grounded?: GroundedMetadata;
    sections?: TextSection[]; // List of sections with descriptions and line indexes
}

/** Grounded-extraction summary stored on document metadata. Additional keys allowed. */
export interface GroundedMetadata {
    verdict?: string;
    confidence?: number;
    citation_count?: number;
    verified_citations?: number;
    reviewed_at?: string;
    generated_at?: string;
    /** Source PDF content etag used by the grounded extraction. */
    source_content_etag?: string | null;
    /** @deprecated Grounded source identity is tracked by source_content_etag. */
    source_text_etag?: string | null;
    [key: string]: unknown;
}

export interface Transcript {
    text?: string;
    segments?: TranscriptSegment[];
    etag?: string;
}

export const TextExtractionStatus = {
    success: 'success',
} as const;

export interface TranscriptMediaResult {
    hasText: boolean;
    status: typeof TextExtractionStatus.success;
    message?: string;
    gladiaTranscriptionId?: string;
}

export interface TranscriptSegment {
    start: number;
    text: string;
    speaker?: number;
    end?: number;
    confidence?: number;
    language?: string;
}

export interface ContentSource {
    // the URI of the content source. Usually an URL to the uploaded file inside a cloud file storage like s3.
    source?: string;
    // the mime type of the content source.
    type?: string;
    // the original name of the input file if any
    name?: string;
    // the etag of the content source if any
    etag?: string;
}

/**
 *
 */
export interface RevisionInfo {
    /** Direct parent revision id (omit on the first revision) */
    parent?: string;

    /** The root revision id (omit on the first revision) */
    root: string;

    /** True if this revision is the head revision */
    head: boolean;

    /** Human‑friendly tag or state ("v1.2", "approved") */
    label?: string;

    /** Extra parents when two branches are merged (leave undefined until needed) */
    //merge_parents?: string[]; //maybe later

    /** Pointer to a diff / patch blob if you store deltas instead of full content */
    //delta_ref?: string;
}

/**
 * The content object item is a simplified version of the ContentObject that is returned by the store API when listing objects.
 */
export interface ContentObjectItem<T = JSONObject> extends BaseObject {
    parent?: string; // the id of the direct parent object. The root object doesn't have the parent field set.

    /** An optional path based location for the object */
    location: string; // the path of the parent object

    /**
     * Object status.
     * - created: the object was created and is being processed
     * - processing: the object is being processed
     * - completed: the object was processed and is ready to use
     * - failed: the object processing failed
     * - archived: the object was archived and is no longer available
     */
    status: ContentObjectStatus;

    /**
     * Object type id.
     */
    type?: ContentObjectTypeRef;

    /**
     * Content source information, typically a link to an object store
     */
    content?: ContentSource;

    /**
     * External identifier for integration with other systems
     */
    external_id?: string;

    /** The object properties. This is a JSON object that describes the object, matching the object type schema */
    properties: T; // a JSON object that describes the object

    /** Technical metadata of the object */
    metadata?:
        | VideoMetadata
        | AudioMetadata
        | ImageMetadata
        | DocumentMetadata
        | ContentMetadata
        | Record<string, unknown>;

    /** Token information  */
    tokens?: {
        count?: number; // the number of tokens in the text
        encoding?: string; // the encoding used to calculate the tokens
        etag?: string; //the etag of the text used for the token count
    };

    /**
     * Revision information. This is used to track the history of the object.
     */
    revision: RevisionInfo; // the revision info of the object

    /**
     * Soft delete flag. When true, the object should be considered deleted
     * but is still retained in the database for historical purposes.
     */
    is_deleted?: boolean;

    /**
     * Soft lock flag. When true, the object should be considered read-only
     * and modification attempts should be rejected.
     */
    is_locked?: boolean;

    /**
     * The document score, used for ranking and sorting.
     */
    score?: number;

    /**
     * Computed per-request: the current user's effective permissions on this object.
     */
    user_permissions?: ContentObjectUserPermissions;
}

/**
 * When creating from an uploaded file the content should be an URL to the uploaded file
 */
export interface CreateContentObjectPayload<T = JSONObject>
    extends Partial<Omit<ContentObject<T>, 'id' | 'root' | 'created_at' | 'updated_at' | 'type' | 'owner'>> {
    id?: string; // An optional existing object ID to be replaced by the new one
    type?: string; // the object type ID
    generation_run_info?: GenerationRunMetadata;
}

type LegacyContentObjectTypeRef = Partial<ContentObjectTypeRef> & {
    ref_type?: 'stored' | 'incode';
    id?: string;
    code?: string;
    name?: string;
};

export function getContentTypeRefId(type: ContentObjectTypeRef): string {
    return type.id;
}

export function withContentObjectTypeRefDiscriminator(
    type: ContentObjectTypeRef | LegacyContentObjectTypeRef,
): ContentObjectTypeRef {
    const legacyCode = 'code' in type ? type.code : undefined;
    const id = type.id || legacyCode || '';
    const name = type.name || '';
    if (type.ref_type === 'incode' || isInCodeType(id)) {
        return { ref_type: 'incode', id, name };
    }
    return { ref_type: 'stored', id, name };
}

/**
 * Reference to a content object type. `id` is the canonical identifier for both
 * stored and in-code types.
 */
/**
 * @discriminator ref_type
 */
export type ContentObjectTypeRef = StoredTypeRef | InCodeTypeRef;

interface StoredTypeRef {
    ref_type: 'stored';
    /**
     * MongoDB ObjectId string for stored types
     */
    id: string;
    name: string;
    /**
     * Display hint from the type's intake policy (`intake.default_view`). Enriched by the
     * API on single-object reads so clients can pick the initial view without fetching the
     * type. Absent on list responses and older servers.
     */
    default_view?: ContentTypeIntakePolicy['default_view'];
}

interface InCodeTypeRef {
    ref_type: 'incode';
    /**
     * Namespaced identifier for in-code types (e.g. "sys:Invoice", "app:myapp:Contract")
     */
    id: string;
    name: string;
    /**
     * Display hint from the type's intake policy (`intake.default_view`). Enriched by the
     * API on single-object reads so clients can pick the initial view without fetching the
     * type. Absent on list responses and older servers.
     */
    default_view?: ContentTypeIntakePolicy['default_view'];
}

export interface ComplexSearchPayload extends Omit<SearchPayload, 'query'> {
    query?: ComplexSearchQuery;
}

export interface ColumnLayout {
    /**
     * The path of the field to use (e.g. "properties.title")
     */
    field: string;
    /**
     * The name to display in the table column
     */
    name: string;
    /**
     * The type of the field specifies how the rendering will be done. If not specified the string type will be used.
     * The type may contain additional parameters prepended using a web-like query string syntax: date?LLL
     */
    type?: string;
    /*
     * a fallback field to use if the field is not present in the object
     */
    fallback?: string;
    /**
     * A default value to be used if the field is not present in the object
     */
    default?: unknown;
}

export type ContentObjectTypeStatus = 'active' | 'draft';

/** Vision detail level names referenced by intake policies. The rendering profiles behind the
 * names (dpi, max size, quality, color mode) are PLATFORM-defined and project-overridable —
 * a type only ever references a detail name. */
export type IntakeVisionDetail = 'low' | 'standard' | 'high';

/**
 * Named page scope for intake conversion/extraction: everything or the locate-pass result.
 * Static page ranges live in the sibling `page_ranges` field (which wins when set) — kept as
 * a SEPARATE field because scalar-or-collection unions generate unstable API clients.
 */
export type IntakePageScope = 'all' | 'located';

/**
 * Static page ranges: inclusive [start, end] pairs; negative indexes count from the end of
 * the document ([[1, 2], [-1, -1]] = first two pages plus the last page).
 */
export type IntakePageRanges = [number, number][];

/** Rendering settings behind a vision detail name (platform defaults, project-overridable
 * via `configuration.intake.vision_profiles`). */
export interface IntakeVisionProfileSettings {
    /** Render resolution in dots per inch. */
    dpi: number;
    /** Maximum height/width of the rendered page image in pixels. */
    max_hw: number;
    /** JPEG quality (0-100). */
    quality: number;
    /** grayscale renders gray always; auto keeps color when the plan asks for it. */
    color_mode: 'grayscale' | 'auto';
}

export interface ContentTypeExtractionGroundingReviewPolicy {
    /** Set false to disable an inherited grounding review pass for this type. */
    enabled?: boolean;
    /** Model execution configuration for the review interaction. */
    config?: InteractionExecutionConfiguration;
    /** Hardness score at or above which review runs. Defaults to hardness_threshold. */
    threshold?: number;
    /**
     * Review also runs when any page's citation coverage falls below this
     * floor (evidence of missed content). Default 0.2.
     */
    coverage_threshold?: number;
    /** Run review regardless of hardness. */
    force?: boolean;
}

export interface ContentTypeExtractionGroundingPolicy {
    /** Enable PDF block-level citation grounding for property extraction. */
    enabled?: boolean;
    /** Grounded extraction interaction. Defaults to the system grounded extractor. */
    interaction?: string;
    /** Maximum pages to process. */
    max_pages?: number;
    /** Run OCR on every page even when a text layer exists. */
    force_ocr?: boolean;
    /** Attach instrumented page images to the grounded extraction prompt. */
    use_vision?: boolean;
    /**
     * How to read pages with no digital text layer (scans / image-only pages).
     * 'vision' (default): read them off the page image and skip OCR. 'ocr': legacy
     * path — OCR those pages and block-ground on the (lossy) OCR text.
     */
    raster_mode?: 'vision' | 'ocr';
    /**
     * A1 locate-grid cell size in PDF points for vision pages. Smaller = finer grid
     * (more cells, tighter boxes) but can trip weaker models into over-reading;
     * tune per the model in `config`. Default 15.
     */
    grid_cell_pt?: number;
    /**
     * Drop block bounding boxes from the extraction prompt. Only sound with
     * use_vision (layout comes from the image).
     */
    omit_block_boxes?: boolean;
    /** Maximum pages per grounded extraction call before windowing. */
    window_pages?: number;
    /** Update object properties with grounded extraction data. Default true. */
    update_properties?: boolean;
    /** Model execution configuration for the main grounded extraction interaction. */
    config?: InteractionExecutionConfiguration;
    /** Model execution configuration used for hard-to-read content. */
    hard_config?: InteractionExecutionConfiguration;
    /** Hardness score at or above which hard_config is used. Default 0.5. */
    hardness_threshold?: number;
    /**
     * Minimum citations-per-leaf-value ratio; completions below it retry with
     * escalation. Default 0.3.
     */
    min_citation_density?: number;
    /** Re-run OCR instead of restoring durable OCR artifacts (stale pipeline output). */
    refresh_ocr?: boolean;
    /** Optional post-extraction review pass. */
    review?: ContentTypeExtractionGroundingReviewPolicy;
}

/**
 * Per-content-type policy for the standard intake workflows.
 */
export interface ContentTypeIntakePolicy {
    /** Intake orchestration mode for this type. */
    mode?: 'programmatic' | 'agentic';
    /** Guidance used when selecting or creating this content type. */
    identification?: {
        guidance?: string;
        distinguish_from?: string;
        examples?: string[];
    };
    /**
     * Document-map ("locate") pass: page thumbnails tiled into labeled contact sheets, one
     * vision call returns which pages matter for THIS type. The result can scope conversion
     * and extraction, and doubles as the vision planner for visual extraction.
     */
    locate?: {
        /** What to look for ("commercial terms, payment schedule, signature pages"). */
        instructions: string;
        /** Pages per contact sheet: 8 = bigger tiles (headings readable). Default 16. */
        detail?: 8 | 16;
        /** Only run when the page count is at least this. Default 8. */
        min_pages?: number;
    };
    /** Controls source-to-text conversion before extraction and embedding. */
    text_conversion?: {
        enabled?: boolean;
        method?: 'auto' | 'basic' | 'llm' | 'custom';
        custom?: {
            interaction?: string;
            agent?: string;
        };
        instructions?: string;
        output_format?: 'markdown' | 'text';
        /** Which pages to convert: everything or the locate result. Default all. */
        scope?: IntakePageScope;
        /** Static page ranges to convert (wins over `scope` when set). */
        page_ranges?: IntakePageRanges;
    };
    /** Controls schema-property extraction after type assignment. */
    extraction?: {
        enabled?: boolean;
        source?: 'auto' | 'text' | 'vision' | 'mixed';
        instructions?: string;
        interaction?: string;
        /** Which pages extraction sees: everything or the locate result. */
        scope?: IntakePageScope;
        /** Static page ranges extraction sees (wins over `scope` when set). */
        page_ranges?: IntakePageRanges;
        /** Cap on pages sent to extraction. Default 20. */
        max_pages?: number;
        /** Vision evidence budget for visual extraction. Detail names reference platform
         * profiles; the type never defines dpi/quality/resolution. */
        vision?: {
            default_detail?: IntakeVisionDetail;
            allowed_details?: IntakeVisionDetail[];
            /** PRIMARY budget: estimated image tokens per extraction call. Default 16000. */
            max_image_tokens?: number;
            /** Transport guard in megabytes. Default 16. */
            max_payload_mb?: number;
            /** Cap on page images per extraction call. Default 8. */
            max_pages_per_call?: number;
        };
        verification?: {
            enabled?: boolean;
            model?: string;
            environment?: string;
            materiality?: string;
            threshold?: number;
            max_retries?: number;
            on_fail?: 'flag' | 'block';
        };
        /** Controls PDF block-level citation grounding with annotated proof output. */
        grounding?: ContentTypeExtractionGroundingPolicy;
    };
    /** Handlebars template used to materialize extracted properties into object text. */
    rendering_template?: string;
    /** Per-type embedding switches. Unspecified values inherit the project policy. */
    embeddings?: Partial<Record<SupportedEmbeddingTypes, boolean>>;
    /** Whether intake should generate a table of contents for matching documents. */
    generate_toc?: boolean;
    /** Preferred first view for objects of this type. */
    default_view?: 'auto' | 'text' | 'pdf' | 'image' | 'properties';
}

/** Per-content-type policy for collaborative document editing. */
export interface ContentTypeEditingPolicy {
    /** Agent interaction used for new document-editing sessions. Defaults to sys:GeneralAgent. */
    interaction?: string;
}

export const ContentTypeEditingPolicySchema: JSONSchemaType<ContentTypeEditingPolicy> = {
    type: 'object',
    description: 'Per-content-type policy for collaborative document editing.',
    required: [],
    additionalProperties: false,
    properties: {
        interaction: {
            type: 'string',
            description: 'Agent interaction used for new document-editing sessions. Omit to use sys:GeneralAgent.',
            nullable: true,
        },
    },
};

/** Reusable sub-schema for IntakePageScope ('all' | 'located'). */
const IntakePageScopeSchema = {
    type: 'string',
    enum: ['all', 'located'],
    description: "Named pages selection: 'all' or 'located' (the locate-pass result). Default all.",
    nullable: true,
};

/** Reusable sub-schema for IntakePageRanges (inclusive [start, end] pairs, negative = from end). */
const IntakePageRangesSchema = {
    type: 'array',
    items: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 },
    description:
        'Static inclusive [start, end] page ranges; negative indexes count from the end ' +
        '([[1,2],[-1,-1]] = first two pages plus the last). Wins over scope when set.',
    nullable: true,
};

const IntakeExecutionConfigurationSchema = {
    type: 'object',
    description: 'Interaction execution configuration such as model, environment, and model options.',
    nullable: true,
    required: [],
    additionalProperties: true,
    properties: {
        id: { type: 'string', nullable: true },
        environment: { type: 'string', nullable: true },
        model: { type: 'string', nullable: true },
        do_validate: { type: 'boolean', nullable: true },
        run_data: { type: 'string', nullable: true },
        configMode: { type: 'string', nullable: true },
        model_options: {
            type: 'object',
            nullable: true,
            required: [],
            additionalProperties: true,
        },
        http_timeout: {
            type: 'object',
            nullable: true,
            required: [],
            additionalProperties: true,
        },
    },
};

const ContentTypeExtractionGroundingPolicySchema = {
    type: 'object',
    description:
        'PDF block-level citation grounding policy. When enabled, property extraction uses the grounded ' +
        'child workflow and stores citations plus annotated proof output.',
    nullable: true,
    required: [],
    additionalProperties: false,
    properties: {
        enabled: {
            type: 'boolean',
            description: 'Enable PDF block-level citation grounding for this type.',
            nullable: true,
        },
        interaction: {
            type: 'string',
            description: 'Grounded extraction interaction id. Omit to use the system grounded extractor.',
            nullable: true,
        },
        max_pages: {
            type: 'integer',
            minimum: 1,
            description: 'Maximum pages to process.',
            nullable: true,
        },
        force_ocr: {
            type: 'boolean',
            description: 'Run OCR on every page even when a text layer exists.',
            nullable: true,
        },
        use_vision: {
            type: 'boolean',
            description: 'Attach instrumented page images to the grounded extraction prompt.',
            nullable: true,
        },
        raster_mode: {
            type: 'string',
            enum: ['vision', 'ocr'],
            description:
                "How to read pages with no digital text layer (scans). 'vision' (default) reads off the page image and skips OCR; 'ocr' is the legacy OCR-then-block-ground path.",
            nullable: true,
        },
        grid_cell_pt: {
            type: 'number',
            minimum: 1,
            description:
                'A1 locate-grid cell size in PDF points for vision pages. Smaller = finer grid; tune per the model in config. Default 14.',
            nullable: true,
        },
        omit_block_boxes: {
            type: 'boolean',
            description: 'Drop block bounding boxes from the extraction prompt (only sound with use_vision).',
            nullable: true,
        },
        window_pages: {
            type: 'integer',
            minimum: 1,
            description:
                'Maximum pages per extraction call before sequential window completion (later windows append to prior). Default 3.',
            nullable: true,
        },
        update_properties: {
            type: 'boolean',
            description: 'Update object properties with grounded extraction data. Default true.',
            nullable: true,
        },
        config: IntakeExecutionConfigurationSchema,
        hard_config: IntakeExecutionConfigurationSchema,
        hardness_threshold: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Hardness score at or above which hard_config is used. Default 0.5.',
            nullable: true,
        },
        min_citation_density: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description:
                'Minimum citations-per-leaf-value ratio; completions below it retry with escalation. Default 0.3.',
            nullable: true,
        },
        refresh_ocr: {
            type: 'boolean',
            description: 'Re-run OCR instead of restoring durable OCR artifacts (stale pipeline output).',
            nullable: true,
        },
        review: {
            type: 'object',
            description: 'Optional post-extraction review pass for hard content.',
            nullable: true,
            required: [],
            additionalProperties: false,
            properties: {
                enabled: {
                    type: 'boolean',
                    description: 'Set false to disable an inherited grounding review pass for this type.',
                    nullable: true,
                },
                config: IntakeExecutionConfigurationSchema,
                threshold: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description: 'Hardness score at or above which review runs.',
                    nullable: true,
                },
                coverage_threshold: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description:
                        "Review also runs when any page's citation coverage falls below this floor. Default 0.2.",
                    nullable: true,
                },
                force: {
                    type: 'boolean',
                    description: 'Run review regardless of hardness.',
                    nullable: true,
                },
            },
        },
    },
};

/** JSON schema for validating ContentTypeIntakePolicy payloads at API/tool boundaries.
 * NOTE: typed via a cast because AJV's strict `JSONSchemaType` mapping cannot express the
 * `[number, number]` pair items of `page_ranges` as a uniform-items array. The runtime
 * schema is compiled (and thus validated) by every consumer and by the schema-acceptance
 * unit test in packages/workflows. */
export const ContentTypeIntakePolicySchema = {
    type: 'object',
    description:
        'Per-content-type policy for standard intake: type selection, conversion, extraction, rendering, and embeddings.',
    required: [],
    additionalProperties: false,
    properties: {
        mode: {
            type: 'string',
            enum: ['programmatic', 'agentic'],
            description:
                'Intake orchestration mode. Use programmatic unless the user explicitly asks for agentic intake.',
            nullable: true,
        },
        identification: {
            type: 'object',
            description: 'Guidance used by automatic type selection to recognize this type before full extraction.',
            nullable: true,
            required: [],
            additionalProperties: false,
            properties: {
                guidance: {
                    type: 'string',
                    description: 'Classifier-facing description of what this type is and when it should be selected.',
                    nullable: true,
                },
                distinguish_from: {
                    type: 'string',
                    description: 'How to distinguish this type from common look-alike document types.',
                    nullable: true,
                },
                examples: {
                    type: 'array',
                    description: 'Object ids of human-confirmed examples for this type.',
                    nullable: true,
                    items: { type: 'string' },
                },
            },
        },
        locate: {
            type: 'object',
            description:
                'Document-map pass: labeled page-thumbnail contact sheets and one vision call return which ' +
                'pages matter for this type. Scopes conversion/extraction and plans visual extraction.',
            nullable: true,
            required: ['instructions'],
            additionalProperties: false,
            properties: {
                instructions: {
                    type: 'string',
                    description: 'What to look for (e.g. "commercial terms, payment schedule, signature pages").',
                },
                detail: {
                    type: 'integer',
                    enum: [8, 16],
                    description: 'Pages per contact sheet: 8 = bigger tiles with readable headings. Default 16.',
                    nullable: true,
                },
                min_pages: {
                    type: 'integer',
                    minimum: 0,
                    description: 'Only run the locate pass when the page count is at least this. Default 8.',
                    nullable: true,
                },
            },
        },
        text_conversion: {
            type: 'object',
            description: 'Controls source-to-text conversion before extraction, search, and text embeddings.',
            nullable: true,
            required: [],
            additionalProperties: false,
            properties: {
                enabled: {
                    type: 'boolean',
                    description: 'Set false for extraction-only types that should not create converted markdown/text.',
                    nullable: true,
                },
                method: {
                    type: 'string',
                    enum: ['auto', 'basic', 'llm', 'custom'],
                    description: 'Conversion method. Use auto unless the user asks for a specific converter.',
                    nullable: true,
                },
                custom: {
                    type: 'object',
                    description: 'Custom conversion implementation for method=custom.',
                    nullable: true,
                    required: [],
                    additionalProperties: false,
                    properties: {
                        interaction: {
                            type: 'string',
                            description: 'Interaction id to call for custom conversion.',
                            nullable: true,
                        },
                        agent: {
                            type: 'string',
                            description: 'Agent id to launch for custom conversion.',
                            nullable: true,
                        },
                    },
                },
                instructions: {
                    type: 'string',
                    description: 'Instructions for what source content to preserve during conversion.',
                    nullable: true,
                },
                output_format: {
                    type: 'string',
                    enum: ['markdown', 'text'],
                    description: 'Output format for converted text. Prefer markdown for readable documents.',
                    nullable: true,
                },
                scope: IntakePageScopeSchema,
                page_ranges: IntakePageRangesSchema,
            },
        },
        extraction: {
            type: 'object',
            description: 'Controls structured property extraction against the content type object_schema.',
            nullable: true,
            required: [],
            additionalProperties: false,
            properties: {
                enabled: {
                    type: 'boolean',
                    description: 'Whether intake should extract structured properties for this type.',
                    nullable: true,
                },
                source: {
                    type: 'string',
                    enum: ['auto', 'text', 'vision', 'mixed'],
                    description:
                        'Evidence source for extraction: auto chooses text or vision, text sends text only, vision sends image/PDF evidence only, mixed sends both.',
                    nullable: true,
                },
                instructions: {
                    type: 'string',
                    description: 'Type-specific extraction instructions such as pages or sections to ignore.',
                    nullable: true,
                },
                interaction: {
                    type: 'string',
                    description: 'Interaction id used for extraction. Omit to use the system extractor.',
                    nullable: true,
                },
                scope: IntakePageScopeSchema,
                page_ranges: IntakePageRangesSchema,
                max_pages: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Cap on pages sent to extraction. Default 20.',
                    nullable: true,
                },
                vision: {
                    type: 'object',
                    description:
                        'Vision evidence budget for visual extraction. Detail names reference platform-defined ' +
                        'profiles; the type never sets dpi, quality, or resolution.',
                    nullable: true,
                    required: [],
                    additionalProperties: false,
                    properties: {
                        default_detail: {
                            type: 'string',
                            enum: ['low', 'standard', 'high'],
                            description: 'Detail profile used when the plan does not request one. Default standard.',
                            nullable: true,
                        },
                        allowed_details: {
                            type: 'array',
                            items: { type: 'string', enum: ['low', 'standard', 'high'] },
                            description: 'Detail profiles the plan may request. Others fall back to default_detail.',
                            nullable: true,
                        },
                        max_image_tokens: {
                            type: 'integer',
                            minimum: 1,
                            description: 'PRIMARY budget: estimated image tokens per extraction call. Default 16000.',
                            nullable: true,
                        },
                        max_payload_mb: {
                            type: 'number',
                            minimum: 1,
                            description: 'Transport guard in megabytes. Default 16.',
                            nullable: true,
                        },
                        max_pages_per_call: {
                            type: 'integer',
                            minimum: 1,
                            description: 'Cap on page images per extraction call. Default 8.',
                            nullable: true,
                        },
                    },
                },
                verification: {
                    type: 'object',
                    description: 'Optional safe-mode verification of extracted values against source evidence.',
                    nullable: true,
                    required: [],
                    additionalProperties: false,
                    properties: {
                        enabled: {
                            type: 'boolean',
                            description: 'Whether to verify extracted values after extraction.',
                            nullable: true,
                        },
                        model: { type: 'string', description: 'Verifier model override.', nullable: true },
                        environment: {
                            type: 'string',
                            description: 'Verifier environment override.',
                            nullable: true,
                        },
                        materiality: {
                            type: 'string',
                            description: 'What errors are material for this type.',
                            nullable: true,
                        },
                        threshold: {
                            type: 'number',
                            minimum: 0,
                            maximum: 1,
                            description: 'Minimum verification confidence before flag/block behavior applies.',
                            nullable: true,
                        },
                        max_retries: {
                            type: 'integer',
                            minimum: 0,
                            description: 'Maximum extraction retries when verification fails.',
                            nullable: true,
                        },
                        on_fail: {
                            type: 'string',
                            enum: ['flag', 'block'],
                            description: 'Failure behavior after retries: flag for review or block property write.',
                            nullable: true,
                        },
                    },
                },
                grounding: ContentTypeExtractionGroundingPolicySchema,
            },
        },
        rendering_template: {
            type: 'string',
            description: 'Handlebars template used to materialize extracted properties into object text.',
            nullable: true,
        },
        embeddings: {
            type: 'object',
            description: 'Per-type embedding switches. Omitted fields inherit the project embedding policy.',
            nullable: true,
            required: [],
            additionalProperties: false,
            properties: {
                text: { type: 'boolean', description: 'Whether to generate text embeddings.', nullable: true },
                image: { type: 'boolean', description: 'Whether to generate image embeddings.', nullable: true },
                properties: {
                    type: 'boolean',
                    description: 'Whether to generate property embeddings.',
                    nullable: true,
                },
            },
        },
        generate_toc: {
            type: 'boolean',
            description: 'Whether intake should generate table-of-contents sections for this type.',
            nullable: true,
        },
        default_view: {
            type: 'string',
            enum: ['auto', 'text', 'pdf', 'image', 'properties'],
            description: 'Preferred first view for objects of this type.',
            nullable: true,
        },
    },
} as unknown as JSONSchemaType<ContentTypeIntakePolicy>;

export interface ContentObjectType extends ContentObjectTypeItem {}
export interface ContentObjectTypeItem extends BaseObject {
    status?: ContentObjectTypeStatus;
    is_chunkable?: boolean;
    intake?: ContentTypeIntakePolicy;
    editing?: ContentTypeEditingPolicy;
    /**
     * This is only included in ContentObjectTypeItem if explicitly requested
     * It is always included in ContentObjectType
     */
    table_layout?: ColumnLayout[];
    /**
     * this is only included in ContentObjectTypeItem if explicitly requested
     * It is always included in ContentObjectType
     */
    object_schema?: Record<string, unknown>; // an optional JSON schema for the object properties.

    /**
     * Determines if the content will be validated against the object schema a generation time and save/update time.
     */
    strict_mode?: boolean;
}
export type InCodeTypeDefinition = Pick<
    ContentObjectTypeItem,
    | 'id'
    | 'name'
    | 'description'
    | 'tags'
    | 'object_schema'
    | 'table_layout'
    | 'is_chunkable'
    | 'strict_mode'
    | 'status'
    | 'intake'
    | 'editing'
>;
export interface ContentObjectTypeCatalogEntry extends InCodeTypeDefinition {
    updated_by?: string;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
}
/**
 * The itnerface to be used whend efining types in a plugin app.
 */
export type InCodeTypeSpec = Omit<InCodeTypeDefinition, 'id'>;

/**
 * Returns true if the type id represents an in-code type (system or app-contributed).
 * In-code types use colon-separated ids like "sys:Invoice" or "app:myapp:Article".
 * These types are read-only and cannot be edited through the UI.
 */
export function isInCodeType(typeId: string): boolean {
    return typeId.includes(':');
}

export interface CreateContentObjectTypePayload
    extends Omit<ContentObjectType, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {}

export enum WorkflowRuleInputType {
    single = 'single',
    multiple = 'multiple',
    none = 'none',
}
export interface WorkflowRuleItem extends BaseObject {
    // the name of the workflow function
    endpoint: string;
    input_type: WorkflowRuleInputType;
}
export interface WorkflowRule extends WorkflowRuleItem {
    /*
     * mongo matching rules for a content event
     */
    match?: Record<string, unknown>;
    /**
     * Activities configuration if any.
     */
    config?: Record<string, unknown>;

    /**
     * Debug mode for the rule
     * @default false
     */
    debug?: boolean;

    /**
     * Customer override for the rule
     * When set to true the rule will not be updated by the system
     */
    customer_override?: boolean;

    /**
     * Optional task queue name to use when starting workflows for this rule
     */
    task_queue?: string;

    /**
     * Event subscription migration status for legacy workflow-rule cutover.
     */
    event_subscription_migration_status?: 'migrated' | 'unsupported_match' | 'failed';

    /**
     * Migration failure or unsupported-match reason, when applicable.
     */
    event_subscription_migration_error?: string;
}

export interface CreateWorkflowRulePayload extends UploadWorkflowRulePayload {
    name: string; // required
    endpoint: string; // required
}
export interface UploadWorkflowRulePayload
    extends Partial<Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at' | 'owner'>> {}

export enum ImageRenditionFormat {
    jpeg = 'jpeg',
    png = 'png',
    webp = 'webp',
}

export enum MarkdownRenditionFormat {
    docx = 'docx',
    pdf = 'pdf',
}

export interface GetRenditionParams {
    format: ImageRenditionFormat | MarkdownRenditionFormat;
    max_hw?: number;
    generate_if_missing?: boolean;
    sign_url?: boolean;
    block_on_generation?: boolean;
}

export interface GetRenditionResponse {
    status: 'found' | 'generating' | 'failed';
    renditions?: string[]; //file paths for the renditions
    workflow_run_id?: string;
}

export interface ObjectSearchResponse {
    results: ContentObjectItemApiResponse[];
    facets: ComputedFacetResponse;
    aggregations?: Record<string, unknown>;
}

// ============================================================================
// Rendition Format Compatibility Utilities
// ============================================================================

export type RenditionFormat = ImageRenditionFormat | MarkdownRenditionFormat;

/**
 * Matrix of supported content type → format conversions.
 * This is the authoritative source of truth for what renditions can be generated.
 *
 * Key patterns:
 * - Exact MIME types (e.g., 'application/pdf')
 * - Wildcard patterns (e.g., 'image/*', 'video/*')
 */
const RENDITION_COMPATIBILITY: Record<string, RenditionFormat[]> = {
    // Image formats can generate: jpeg, png, webp
    'image/*': [ImageRenditionFormat.jpeg, ImageRenditionFormat.png, ImageRenditionFormat.webp],
    // Video formats can generate: jpeg, png (thumbnails)
    'video/*': [ImageRenditionFormat.jpeg, ImageRenditionFormat.png],
    // PDF can generate: jpeg, png, webp (page images)
    'application/pdf': [ImageRenditionFormat.jpeg, ImageRenditionFormat.png, ImageRenditionFormat.webp],
    // Markdown can generate: pdf, docx (NOT jpeg/png)
    'text/markdown': [MarkdownRenditionFormat.pdf, MarkdownRenditionFormat.docx],
    // Any text/* can generate: docx (editable export)
    'text/*': [MarkdownRenditionFormat.docx],
    // Office documents can generate: pdf
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [MarkdownRenditionFormat.pdf],
    'application/msword': [MarkdownRenditionFormat.pdf],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': [MarkdownRenditionFormat.pdf],
    'application/vnd.ms-powerpoint': [MarkdownRenditionFormat.pdf],
};

/**
 * Check if a specific rendition format can be generated from a content type.
 *
 * @param contentType - The MIME type of the source content (e.g., 'image/png', 'text/markdown')
 * @param format - The desired rendition format (e.g., ImageRenditionFormat.jpeg)
 * @returns true if the format can be generated from the content type
 *
 * @example
 * canGenerateRendition('image/png', ImageRenditionFormat.jpeg) // true
 * canGenerateRendition('text/markdown', ImageRenditionFormat.jpeg) // false
 * canGenerateRendition('text/markdown', MarkdownRenditionFormat.pdf) // true
 */
export function canGenerateRendition(contentType: string | undefined, format: RenditionFormat | string): boolean {
    if (!contentType) return false;

    const formatStr = typeof format === 'string' ? format : format;

    // Check exact match first
    const exactMatch = RENDITION_COMPATIBILITY[contentType];
    if (exactMatch?.some((f) => f === formatStr)) {
        return true;
    }

    // Check wildcard patterns (e.g., 'image/*', 'video/*')
    const [category] = contentType.split('/');
    const wildcardKey = `${category}/*`;
    const wildcardMatch = RENDITION_COMPATIBILITY[wildcardKey];
    if (wildcardMatch?.some((f) => f === formatStr)) {
        return true;
    }

    return false;
}

/**
 * Get the list of rendition formats supported for a given content type.
 *
 * @param contentType - The MIME type of the source content
 * @returns Array of supported rendition formats, or empty array if none
 *
 * @example
 * getSupportedRenditionFormats('image/png') // [jpeg, png, webp]
 * getSupportedRenditionFormats('text/markdown') // [pdf, docx]
 * getSupportedRenditionFormats('text/html') // []
 */
export function getSupportedRenditionFormats(contentType: string | undefined): RenditionFormat[] {
    if (!contentType) return [];

    // Check exact match first
    if (RENDITION_COMPATIBILITY[contentType]) {
        return [...RENDITION_COMPATIBILITY[contentType]];
    }

    // Check wildcard patterns
    const [category] = contentType.split('/');
    const wildcardKey = `${category}/*`;
    const wildcardMatch = RENDITION_COMPATIBILITY[wildcardKey];
    if (wildcardMatch) {
        return [...wildcardMatch];
    }

    return [];
}

/**
 * Check if a content type supports visual (image) renditions.
 * This is useful for determining if a document can have thumbnails/previews.
 *
 * @param contentType - The MIME type of the source content
 * @returns true if the content type can generate JPEG renditions
 *
 * @example
 * supportsVisualRendition('image/png') // true
 * supportsVisualRendition('application/pdf') // true
 * supportsVisualRendition('text/markdown') // false
 */
export function supportsVisualRendition(contentType: string | undefined): boolean {
    return canGenerateRendition(contentType, ImageRenditionFormat.jpeg);
}

export interface GetUploadUrlPayload {
    name: string;
    id?: string;
    mime_type?: string;
    ttl?: number;
}

export interface GetFileUrlPayload {
    file: string;
    // Optional filename to use in Content-Disposition for downloads
    name?: string;
    // Optional disposition for downloads (default: attachment)
    disposition?: 'inline' | 'attachment';
}

export interface GetFileUrlResponse {
    url: string;
    id: string;
    mime_type?: string;
    path: string;
}

export interface EnsureBucketReadAccessPayload {
    principal: string;
}

export interface EnsureBucketReadAccessResponse {
    bucket: string;
    principal: string;
    granted: boolean;
}

export interface BucketReadAccessStatusResponse {
    bucket: string;
    principal: string;
    hasAccess: boolean;
}

export interface FileMetadataResponse {
    name: string;
    size: number;
    contentType: string;
    contentDisposition?: string;
    etag?: string;
    customMetadata?: Record<string, string>;
}

export interface SetFileMetadataPayload {
    /** The file path (relative to bucket) or full URI */
    file: string;
    /** Custom metadata key-value pairs to set on the file */
    metadata: Record<string, string>;
}

export interface FileMetadataUpdateResult {
    success: boolean;
    file: string;
}

export interface BulkUploadUrlsPayload {
    files: { name: string; mime_type?: string; id?: string }[];
}

export interface BulkUploadUrlsResponse {
    files: GetFileUrlResponse[];
}

export interface FileBucketResponse {
    bucket: string;
}

export interface FileListResponse {
    files: string[];
}

export interface FileMetadataQuery {
    file: string;
}

export interface FileListQuery {
    prefix: string;
}

export interface FileDeleteQuery {
    prefix?: boolean;
}

export interface ContentObjectTypeCatalogQuery {
    tag?: string;
    layout?: boolean;
    schema?: boolean;
    limit?: number;
    offset?: number;
}

export interface ContentObjectTypeListQuery {
    name?: string;
    chunkable?: boolean;
    layout?: boolean;
    schema?: boolean;
    limit?: number;
    offset?: number;
}

export interface CopyFilePayload {
    source: string;
    dest: string;
}

export interface CopyFileResponse {
    success: boolean;
    source: string;
    dest: string;
}

export interface DeleteFileResult {
    success: boolean;
    count: number;
    message?: string;
    file?: string;
}

export enum ContentObjectProcessingPriority {
    normal = 'normal',
    low = 'low',
}
