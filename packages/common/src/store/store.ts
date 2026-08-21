import type { z } from 'zod';
import type {
    ContentObjectTypeRefSchema,
    InCodeTypeRefSchema,
    StoredTypeRefSchema,
} from '../api-schemas/app-lifecycle.js';
import type {
    ComplexSearchPayloadSchema,
    ContentObjectApiResponseSchema,
    ContentObjectApiRevisionSchema,
    ContentObjectApiTypeRefSchema,
    ContentObjectExportArtifactFileSchema,
    ContentObjectExportArtifactSchema,
    ContentObjectExportProgressSchema,
    ContentObjectExportResultSchema,
    ContentObjectExportStatusResponseSchema,
    ContentObjectItemApiResponseSchema,
    ContentObjectTextResponseSchema,
    ContentObjectUserPermissionsSchema,
    ContentSourceSchema,
    CreateContentObjectHeadersSchema,
    CreateContentObjectPayloadSchema,
    CreateContentObjectQuerySchema,
    DeleteContentObjectExportResponseSchema,
    DeleteContentObjectResultSchema,
    EmbeddingSchema,
    ExportContentObjectsFilterSchema,
    ExportContentObjectsIncludeOptionsSchema,
    GenerationRunMetadataSchema,
    GetObjectRenditionQuerySchema,
    GetRenditionResponseSchema,
    InheritedPropertyMetadataSchema,
    ListContentObjectExportsResponseSchema,
    ObjectSearchResponseSchema,
    ProjectedContentObjectApiResponseSchema,
    RevisionInfoSchema,
    SetObjectEmbeddingsResponseSchema,
    SetObjectTextPayloadSchema,
    StartContentObjectExportRequestSchema,
    StartContentObjectExportResponseSchema,
    TranscriptSchema,
    TranscriptSegmentSchema,
    UpdateContentObjectHeadersSchema,
    UpdateContentObjectPayloadSchema,
    UpdateContentObjectQuerySchema,
} from '../api-schemas/content.js';
import type { MarkdownRenditionFormatSchema } from '../api-schemas/document-processing.js';
import type {
    CreateWorkflowRulePayloadSchema,
    UpdateWorkflowRulePayloadSchema,
    WorkflowRuleItemSchema,
    WorkflowRuleSchema,
} from '../api-schemas/events.js';
import type {
    BucketCreateAccessStatusResponseSchema,
    BucketReadAccessStatusResponseSchema,
    BulkUploadUrlsPayloadSchema,
    BulkUploadUrlsResponseSchema,
    CopyFilePayloadSchema,
    CopyFileResponseSchema,
    DeleteFileResultSchema,
    EnsureBucketCreateAccessPayloadSchema,
    EnsureBucketCreateAccessResponseSchema,
    EnsureBucketReadAccessPayloadSchema,
    EnsureBucketReadAccessResponseSchema,
    FileBucketResponseSchema,
    FileDeleteQuerySchema,
    FileListQuerySchema,
    FileListResponseSchema,
    FileMetadataQuerySchema,
    FileMetadataResponseSchema,
    FileMetadataUpdateResultSchema,
    GetFileUrlPayloadSchema,
    GetFileUrlResponseSchema,
    GetUploadUrlPayloadSchema,
    SetFileMetadataPayloadSchema,
} from '../api-schemas/files.js';
import type {
    ColumnLayoutSchema,
    ContentObjectTypeCatalogEntrySchema,
    ContentObjectTypeCatalogQuerySchema,
    ContentObjectTypeItemSchema,
    ContentObjectTypeListQuerySchema,
    ContentObjectTypeSchema,
    ContentObjectTypeStatusSchema,
    ContentTypeEditingPolicySchema,
    ContentTypeExtractionGroundingPolicySchema,
    ContentTypeExtractionGroundingReviewPolicySchema,
    ContentTypeIntakePolicySchema,
    CreateContentObjectTypePayloadSchema,
    InCodeTypeDefinitionSchema,
    IntakePageRangesSchema,
    IntakePageScopeSchema,
    IntakeVisionDetailSchema,
    UpdateContentObjectTypePayloadSchema,
} from '../api-schemas/store.js';
import type { JSONObject } from '../json.js';
import type { SupportedEmbeddingTypes } from '../project.js';
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

export type CreateContentObjectQuery = z.infer<typeof CreateContentObjectQuerySchema>;

export type CreateContentObjectHeaders = z.infer<typeof CreateContentObjectHeadersSchema>;

export type UpdateContentObjectQuery = z.infer<typeof UpdateContentObjectQuerySchema>;

export type UpdateContentObjectHeaders = z.infer<typeof UpdateContentObjectHeadersSchema>;

export type GetObjectRenditionQuery = z.infer<typeof GetObjectRenditionQuerySchema>;

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

export type Embedding = z.infer<typeof EmbeddingSchema>;

export type ExportContentObjectsIncludeOptions = z.infer<typeof ExportContentObjectsIncludeOptionsSchema>;

export type ExportContentObjectsFilter = z.infer<typeof ExportContentObjectsFilterSchema>;

export type StartContentObjectExportRequest = z.infer<typeof StartContentObjectExportRequestSchema>;

export type StartContentObjectExportResponse = z.infer<typeof StartContentObjectExportResponseSchema>;

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

export type ContentObjectExportResult = z.infer<typeof ContentObjectExportResultSchema>;

export type ContentObjectExportProgress = z.infer<typeof ContentObjectExportProgressSchema>;

export type ContentObjectExportStatusResponse = z.infer<typeof ContentObjectExportStatusResponseSchema>;

export type ContentObjectExportArtifact = z.infer<typeof ContentObjectExportArtifactSchema>;

export type ContentObjectExportArtifactFile = z.infer<typeof ContentObjectExportArtifactFileSchema>;

export type ListContentObjectExportsResponse = z.infer<typeof ListContentObjectExportsResponseSchema>;

export type DeleteContentObjectExportResponse = z.infer<typeof DeleteContentObjectExportResponseSchema>;

export type InheritedPropertyMetadata = z.infer<typeof InheritedPropertyMetadataSchema>;
export type ContentObjectUserPermissions = z.infer<typeof ContentObjectUserPermissionsSchema>;

export type ContentObjectTextResponse = z.infer<typeof ContentObjectTextResponseSchema>;

export type SetObjectTextPayload = z.infer<typeof SetObjectTextPayloadSchema>;

export type DeleteContentObjectResult = z.infer<typeof DeleteContentObjectResultSchema>;

export type SetObjectEmbeddingsResponse = z.infer<typeof SetObjectEmbeddingsResponseSchema>;

export type ContentObjectApiTypeRef = z.infer<typeof ContentObjectApiTypeRefSchema>;

export type ContentObjectApiRevision = z.infer<typeof ContentObjectApiRevisionSchema>;

export type ContentObjectItemApiResponse = z.infer<typeof ContentObjectItemApiResponseSchema>;

export type ContentObjectApiResponse = z.infer<typeof ContentObjectApiResponseSchema>;

export type ProjectedContentObjectApiResponse = z.infer<typeof ProjectedContentObjectApiResponseSchema>;

export type FullObjectSearchResponse = Omit<ObjectSearchResponse, 'results'> & {
    results: ContentObjectItemApiResponse[];
};

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

export type GenerationRunMetadata = z.infer<typeof GenerationRunMetadataSchema>;

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
interface TemporalMediaMetadata extends ContentMetadata {
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
interface GroundedMetadata {
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

export type Transcript = z.infer<typeof TranscriptSchema>;

export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export type ContentSource = z.infer<typeof ContentSourceSchema>;

export type RevisionInfo = z.infer<typeof RevisionInfoSchema>;

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

type CreateContentObjectPayloadWire = z.infer<typeof CreateContentObjectPayloadSchema>;
export type CreateContentObjectPayload<T = JSONObject> = Omit<
    CreateContentObjectPayloadWire,
    'properties' | 'metadata'
> & {
    properties?: T;
    /** Known metadata interfaces remain assignable; the runtime contract deliberately accepts any object keys. */
    metadata?: ContentObjectItem['metadata'];
};

export function getContentTypeRefId(type: ContentObjectTypeRef): string {
    return type.id;
}

export type ContentObjectTypeRef = z.infer<typeof ContentObjectTypeRefSchema>;

export type ComplexSearchPayload = z.infer<typeof ComplexSearchPayloadSchema>;

export type ColumnLayout = z.infer<typeof ColumnLayoutSchema>;

export type ContentObjectTypeStatus = z.infer<typeof ContentObjectTypeStatusSchema>;

export type IntakeVisionDetail = z.infer<typeof IntakeVisionDetailSchema>;

export type IntakePageScope = z.infer<typeof IntakePageScopeSchema>;

/**
 * Inclusive `[start, end]` pairs.
 *
 * Inferred as `number[][]` rather than the `[number, number][]` this used to declare: the published
 * component is a uniform-items array with `minItems`/`maxItems`, which is what the scanner made of the
 * tuple, and reproducing it is what keeps the generated clients unchanged. The length is still
 * enforced at runtime.
 */
export type IntakePageRanges = z.infer<typeof IntakePageRangesSchema>;

export type ContentTypeExtractionGroundingReviewPolicy = z.infer<
    typeof ContentTypeExtractionGroundingReviewPolicySchema
>;

export type ContentTypeExtractionGroundingPolicy = z.infer<typeof ContentTypeExtractionGroundingPolicySchema>;

export type ContentTypeIntakePolicy = z.infer<typeof ContentTypeIntakePolicySchema>;

// No TSDoc: the description is the canonical schema's, and a doc comment above a canonical alias is
// published a second time.
//
// The hand-written AJV `ContentTypeEditingPolicySchema` that used to sit here is gone. It said the
// same thing as the Zod schema and had to be kept in step by hand; `./editing-policy-schema.generated.ts`
// now emits it from the canonical component, under the same exported name, so the validator the types
// resource compiles and the component the spec publishes are the same object.
export type ContentTypeEditingPolicy = z.infer<typeof ContentTypeEditingPolicySchema>;

export type ContentObjectType = z.infer<typeof ContentObjectTypeSchema>;
export type ContentObjectTypeItem = z.infer<typeof ContentObjectTypeItemSchema>;
// Was `Pick<ContentObjectTypeItem, ...>`, and published under the name that derived from:
// `Pick_ContentObjectTypeItem_id_name_description_tags_object_schema_...`. A mapped type over a
// canonical alias resolves to `{}`, so the shape is authored now — and it publishes under its own
// name, which is what the API always meant.
export type InCodeTypeDefinition = z.infer<typeof InCodeTypeDefinitionSchema>;
export type ContentObjectTypeCatalogEntry = z.infer<typeof ContentObjectTypeCatalogEntrySchema>;
/**
 * The itnerface to be used whend efining types in a plugin app.
 */
export type InCodeTypeSpec = Omit<InCodeTypeDefinition, 'id'>;

export type CreateContentObjectTypePayload = z.infer<typeof CreateContentObjectTypePayloadSchema>;

export type UpdateContentObjectTypePayload = z.infer<typeof UpdateContentObjectTypePayloadSchema>;

export enum WorkflowRuleInputType {
    single = 'single',
    multiple = 'multiple',
    none = 'none',
}
export type WorkflowRuleItem = z.infer<typeof WorkflowRuleItemSchema>;
export type WorkflowRule = z.infer<typeof WorkflowRuleSchema>;

export type CreateWorkflowRulePayload = z.infer<typeof CreateWorkflowRulePayloadSchema>;
export interface UploadWorkflowRulePayload
    extends Partial<Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at' | 'owner'>> {}

export enum ImageRenditionFormat {
    jpeg = 'jpeg',
    png = 'png',
    webp = 'webp',
}

export const MarkdownRenditionFormat = {
    docx: 'docx',
    pdf: 'pdf',
} as const;

export type MarkdownRenditionFormat = z.infer<typeof MarkdownRenditionFormatSchema>;

export interface GetRenditionParams {
    format: ImageRenditionFormat | MarkdownRenditionFormat;
    max_hw?: number;
    generate_if_missing?: boolean;
    sign_url?: boolean;
    block_on_generation?: boolean;
}

export type GetRenditionResponse = z.infer<typeof GetRenditionResponseSchema>;

export type ObjectSearchResponse = z.infer<typeof ObjectSearchResponseSchema>;

// ============================================================================
// Rendition Format Compatibility Utilities
// ============================================================================

type RenditionFormat = ImageRenditionFormat | MarkdownRenditionFormat;

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

export type GetUploadUrlPayload = z.infer<typeof GetUploadUrlPayloadSchema>;

export type GetFileUrlPayload = z.infer<typeof GetFileUrlPayloadSchema>;

export type GetFileUrlResponse = z.infer<typeof GetFileUrlResponseSchema>;

export type EnsureBucketReadAccessPayload = z.infer<typeof EnsureBucketReadAccessPayloadSchema>;

export type EnsureBucketReadAccessResponse = z.infer<typeof EnsureBucketReadAccessResponseSchema>;

export type BucketReadAccessStatusResponse = z.infer<typeof BucketReadAccessStatusResponseSchema>;

export type EnsureBucketCreateAccessPayload = z.infer<typeof EnsureBucketCreateAccessPayloadSchema>;

export type EnsureBucketCreateAccessResponse = z.infer<typeof EnsureBucketCreateAccessResponseSchema>;

export type BucketCreateAccessStatusResponse = z.infer<typeof BucketCreateAccessStatusResponseSchema>;

export type FileMetadataResponse = z.infer<typeof FileMetadataResponseSchema>;

export type SetFileMetadataPayload = z.infer<typeof SetFileMetadataPayloadSchema>;

export type FileMetadataUpdateResult = z.infer<typeof FileMetadataUpdateResultSchema>;

export type BulkUploadUrlsPayload = z.infer<typeof BulkUploadUrlsPayloadSchema>;

export type BulkUploadUrlsResponse = z.infer<typeof BulkUploadUrlsResponseSchema>;

export type FileBucketResponse = z.infer<typeof FileBucketResponseSchema>;

export type FileListResponse = z.infer<typeof FileListResponseSchema>;

export type FileMetadataQuery = z.infer<typeof FileMetadataQuerySchema>;

export type FileListQuery = z.infer<typeof FileListQuerySchema>;

export type FileDeleteQuery = z.infer<typeof FileDeleteQuerySchema>;

export type ContentObjectTypeCatalogQuery = z.infer<typeof ContentObjectTypeCatalogQuerySchema>;

export type ContentObjectTypeListQuery = z.infer<typeof ContentObjectTypeListQuerySchema>;

export type CopyFilePayload = z.infer<typeof CopyFilePayloadSchema>;

export type CopyFileResponse = z.infer<typeof CopyFileResponseSchema>;

export type DeleteFileResult = z.infer<typeof DeleteFileResultSchema>;

export enum ContentObjectProcessingPriority {
    normal = 'normal',
    low = 'low',
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

export type InCodeTypeRef = z.infer<typeof InCodeTypeRefSchema>;

export type StoredTypeRef = z.infer<typeof StoredTypeRefSchema>;

type UpdateContentObjectPayloadWire = z.infer<typeof UpdateContentObjectPayloadSchema>;

/**
 * Mirrors {@link CreateContentObjectPayload}: `properties` and `metadata` are reopened over the wire
 * type so the known metadata interfaces stay assignable and callers can name their property shape.
 * The runtime contract accepts any object keys for both.
 */
export type UpdateContentObjectPayload<T = JSONObject> = Omit<
    UpdateContentObjectPayloadWire,
    'properties' | 'metadata'
> & {
    properties?: T;
    metadata?: ContentObjectItem['metadata'];
};

export type UpdateWorkflowRulePayload = z.infer<typeof UpdateWorkflowRulePayloadSchema>;
