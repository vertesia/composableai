import { SearchPayload } from "../payload.js";
import { SupportedEmbeddingTypes } from "../project.js";
import { ComplexSearchQuery } from "../query.js";
import { BaseObject } from "./common.js";

export enum ContentObjectApiHeaders {
    COLLECTION_ID = 'x-collection-id',
    PROCESSING_PRIORITY = 'x-processing-priority',
    CREATE_REVISION = 'x-create-revision',
    REVISION_LABEL = 'x-revision-label',
    /** When set to 'true', prevents this update from triggering workflow rules */
    SUPPRESS_WORKFLOWS = 'x-suppress-workflows',
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
    created = "created",
    processing = "processing", // the was created and still processing
    ready = "ready", // the object is rendered and ready to be used
    completed = "completed",
    failed = "failed",
    archived = "archived",
}

export interface Embedding {
    model: string; //the model used to generate this embedding
    values: number[];
    etag?: string; // the etag of the text used for the embedding
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
export interface ContentObject<T = any> extends ContentObjectItem<T> {
    text?: string; // the text representation of the object
    text_etag?: string;
    embeddings: Partial<Record<SupportedEmbeddingTypes, Embedding>>;
    parts?: string[]; // the list of objectId of the parts of the object
    parts_etag?: string; // the etag of the text used for the parts list
    transcript?: Transcript;
    security?: Record<string, string[]>; // Security field for granular permissions

    /**
     * Inherited properties metadata - tracks which properties were inherited from parent collections.
     * Used to display readonly inherited properties in the UI and enable incremental sync optimization.
     */
    inherited_properties?: InheritedPropertyMetadata[];
}

export enum ContentNature {
    Video = "video",
    Image = "image",
    Audio = "audio",
    Document = "document",
    Code = "code",
    Other = "other"
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

/**
 * @deprecated Use RenditionWithDimensions instead
 */
export type VideoRendition = RenditionWithDimensions;

export const POSTER_RENDITION_NAME = "Poster";
export const AUDIO_RENDITION_NAME = "Audio";
export const WEB_VIDEO_RENDITION_NAME = "Web";
export const PDF_RENDITION_NAME = "PDF";

export interface ContentMetadata {
    // Common fields for all media types
    type?: ContentNature;
    size?: number; // in bytes
    languages?: string[];
    location?: Location;
    generation_runs: GenerationRunMetadata[];
    etag?: string;
    renditions?: Rendition[];
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
        image_count: number;
        zone_count: number;
        needs_ocr_count?: number;
    };
    sections?: TextSection[]; // List of sections with descriptions and line indexes
}

export interface Transcript {
    text?: string;
    segments?: TranscriptSegment[];
    etag?: string;
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
export interface ContentObjectItem<T = Record<string, any>> extends BaseObject {
    parent: string; // the id of the direct parent object. The root object doesn't have the parent field set.

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
    content: ContentSource;

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
    | ContentMetadata;

    /** Token information  */
    tokens?: {
        count: number; // the number of tokens in the text
        encoding: string; // the encoding used to calculate the tokens
        etag: string; //the etag of the text used for the token count
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
}

/**
 * When creating from an uploaded file the content should be an URL to the uploaded file
 */
export interface CreateContentObjectPayload<T = any>
    extends Partial<
        Omit<
            ContentObject<T>,
            "id" | "root" | "created_at" | "updated_at" | "type" | "owner"
        >
    > {
    id?: string; // An optional existing object ID to be replaced by the new one
    type?: string; // the object type ID
    generation_run_info?: GenerationRunMetadata;
}

export function getContentTypeRefId(type: ContentObjectTypeRef) {
    return (type as StoredTypeRef).id || (type as InCodeTypeRef).code;
}

/**
 * Reference to a content object type. Either `id` (stored type) or `code` (in-code type) must be set.
 */
export type ContentObjectTypeRef = StoredTypeRef | InCodeTypeRef;

interface StoredTypeRef {
    /**
     * MongoDB ObjectId string for stored types
     */
    id: string;
    code?: never;
    name: string;
}

interface InCodeTypeRef {
    id?: never;
    /**
     * Namespaced identifier for in-code types (e.g. "sys:Invoice", "app:myapp:Contract")
     */
    code: string;
    name: string;
}

export interface ComplexSearchPayload extends Omit<SearchPayload, "query"> {
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
    default?: any;
}
export interface ContentObjectType extends ContentObjectTypeItem { }
export interface ContentObjectTypeItem extends BaseObject {
    is_chunkable?: boolean;
    /**
     * This is only included in ContentObjectTypeItem if explicitly requested
     * It is always included in ContentObjectType
     */
    table_layout?: ColumnLayout[];
    /**
     * this is only included in ContentObjectTypeItem if explicitly requested
     * It is always included in ContentObjectType
     */
    object_schema?: Record<string, any>; // an optional JSON schema for the object properties.

    /**
     * Determines if the content will be validated against the object schema a generation time and save/update time.
     */
    strict_mode?: boolean;
}
export type InCodeTypeDefinition = Pick<ContentObjectTypeItem, 'id' | 'name' | 'description' | 'tags' | 'object_schema' | 'table_layout' | 'is_chunkable' | 'strict_mode'>;
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
    extends Omit<
        ContentObjectType,
        "id" | "created_at" | "updated_at" | "created_by" | "updated_by"
    > { }

export enum WorkflowRuleInputType {
    single = "single",
    multiple = "multiple",
    none = "none",
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
    match?: Record<string, any>;
    /**
     * Activities configuration if any.
     */
    config?: Record<string, any>;

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
}

export interface CreateWorkflowRulePayload extends UploadWorkflowRulePayload {
    name: string; // required
    endpoint: string; // required
}
export interface UploadWorkflowRulePayload
    extends Partial<
        Omit<WorkflowRule, "id" | "created_at" | "updated_at" | "owner">
    > { }

export enum ImageRenditionFormat {
    jpeg = "jpeg",
    png = "png",
    webp = "webp",
}

export enum MarkdownRenditionFormat {
    docx = "docx",
    pdf = "pdf",
}

export interface GetRenditionParams {
    format: ImageRenditionFormat | MarkdownRenditionFormat;
    max_hw?: number;
    generate_if_missing?: boolean;
    sign_url?: boolean;
    block_on_generation?: boolean;
}

export interface GetRenditionResponse {
    status: "found" | "generating" | "failed";
    renditions?: string[]; //file paths for the renditions
    workflow_run_id?: string;
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
    if (exactMatch && exactMatch.some(f => f === formatStr)) {
        return true;
    }

    // Check wildcard patterns (e.g., 'image/*', 'video/*')
    const [category] = contentType.split('/');
    const wildcardKey = `${category}/*`;
    const wildcardMatch = RENDITION_COMPATIBILITY[wildcardKey];
    if (wildcardMatch && wildcardMatch.some(f => f === formatStr)) {
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
    disposition?: "inline" | "attachment";
}

export interface GetFileUrlResponse {
    url: string;
    id: string;
    mime_type?: string;
    path: string;
}

export interface SetFileMetadataPayload {
    /** The file path (relative to bucket) or full URI */
    file: string;
    /** Custom metadata key-value pairs to set on the file */
    metadata: Record<string, string>;
}

export enum ContentObjectProcessingPriority {
    normal = "normal",
    low = "low",
}
