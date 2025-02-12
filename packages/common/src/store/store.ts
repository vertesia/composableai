import { SearchPayload } from '../payload.js';
import { SupportedEmbeddingTypes } from '../project.js';
import { ComplexSearchQuery } from '../query.js';
import { BaseObject } from './common.js';
import { RenditionProperties } from './index.js';

export enum ContentObjectStatus {
    created = 'created',
    processing = 'processing', // the was created and still processing
    completed = 'completed',
    failed = 'failed',
    archived = 'archived',
}


export interface Embedding {
    model: string; //the model used to generate this embedding
    values: number[];
    etag?: string; // the etag of the text used for the embedding
}

export interface ContentObject<T = any> extends ContentObjectItem<T> {
    text?: string; // the text representation of the object
    text_etag?: string;
    embeddings: Partial<Record<SupportedEmbeddingTypes, Embedding>>;
    parts?: string[]; // the list of objectId of the parts of the object
    parts_etag?: string; // the etag of the text used for the parts list
    transcript?: Transcript;
}


export type ContentNature = 'video' | 'image' | 'audio' | 'document' | 'code' | 'other';

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



export interface ContentMetadata {
    // Common fields for all media types
    type?: ContentNature;
    size?: number;      // in bytes
    languages?: string[];
    location?: Location;
    generation_runs: GenerationRunMetadata[];
    etag?: string;
}

// Example of type-specific metadata interfaces (optional, for better type safety)
export interface TemporalMediaMetadata extends ContentMetadata {
    duration?: number; // in seconds
    transcript?: Transcript
}

export interface ImageMetadata extends ContentMetadata {
    type: 'image';
    dimensions?: Dimensions;
}

export interface AudioMetadata extends TemporalMediaMetadata {
    type: 'audio';
}

export interface VideoMetadata extends TemporalMediaMetadata {
    type: 'video';
    dimensions?: Dimensions;
}

export interface DocumentMetadata extends ContentMetadata {
    type: 'document';
    page_count?: number;
    content_processor?: {
        type?: string;
        features_requested?: string[];
        zones_requested?: string[];
        table_count?: number;
        image_count: number;
        zone_count: number;
        needs_ocr_count?: number;
    }
}

export interface Transcript {
    text?: string;
    segments?: TranscriptSegment[];
    etag?: string;
}

export interface TranscriptSegment {
    start: number
    text: string
    speaker?: number
    end?: number
    language?: string
    confidence?: number
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
 * The content object item is a simplified version of the ContentObject that is returned by the store API when listing objects.
 */
export interface ContentObjectItem<T = any> extends BaseObject {
    root?: string; // the ID of the root parent object. The root object doesn't have the root field set.
    parent: string; // the id of the direct parent object. The root object doesn't have the parent field set.
    location: string; // the path of the parent object
    status: ContentObjectStatus;
    // A ref to the object type
    type?: ContentObjectTypeRef;
    // the content source URL and type
    content: ContentSource;
    external_id?: string;
    properties: T | Record<string, any>; // a JSON object that describes the object
    metadata?: VideoMetadata | AudioMetadata | ImageMetadata | DocumentMetadata | ContentMetadata;
    tokens?: {
        count: number; // the number of tokens in the text
        encoding: string; // the encoding used to calculate the tokens
        etag: string; //the etag of the text used for the token count
    };
    run?: string; // the ID of the interaction run that created the object
}

/**
 * When creating from an uploaded file the content shouild be an URL to the uploaded file
 */
export interface CreateContentObjectPayload<T = any> extends Partial<Omit<ContentObject<T>,
    'id' | 'root' | 'created_at' | 'updated_at' | 'type'
    | 'owner'>> {
    id?: string; // An optional existing object ID to be replaced by the new one
    type?: string; // the object type ID
    generation_run_info?: GenerationRunMetadata;
}

export interface ContentObjectTypeRef {
    id: string;
    name: string;
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
    default?: any;
}
export interface ContentObjectType extends ContentObjectTypeItem {
    object_schema?: Record<string, any>; // an optional JSON schema for the object properties.
    table_layout?: ColumnLayout[]; // an optional table layout for the object properties.
}
export interface ContentObjectTypeItem extends BaseObject {
    is_chunkable?: boolean;
}
/**
 * Used to list types with their table layout if any
 */
export interface ContentObjectTypeLayout {
    id: string;
    name: string;
    description?: string;
    table_layout?: ColumnLayout[];
}

export interface CreateContentObjectTypePayload extends Omit<ContentObjectType, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
}

export enum WorkflowRuleInputType {
    single = 'single',
    multiple = 'multiple',
    none = 'none'
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
}


export interface CreateWorkflowRulePayload extends UploadWorkflowRulePayload {
    name: string; // required
    endpoint: string; // required
}
export interface UploadWorkflowRulePayload extends Partial<Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at' | 'owner'>> {
}

export interface GetRenditionResponse {

    status: 'found' | 'generating' | 'failed';
    rendition?: ContentObject<RenditionProperties> //TODO add <Rendition>
    workflow_run_id?: string;
}

export interface GetUploadUrlPayload {
    name: string;
    id?: string;
    mime_type?: string;
    ttl?: number;
}

export interface GetFileUrlPayload {
    file: string;
}

export interface GetFileUrlResponse {
    url: string;
    id: string;
    mime_type: string;
    path: string;
}
