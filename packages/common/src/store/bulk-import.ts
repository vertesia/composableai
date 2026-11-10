import type { CreateCollectionPayload } from './collections.js';
import type { ContentObjectProcessingPriority, CreateContentObjectPayload } from './store.js';

// What a bulk import exchanges with its caller: the items of the JSON source object, the workflow
// vars, the workflow result and the result file it points to. The workflow's internal batching and
// partitioning shapes stay in @vertesia/workflow/bulk-import, which re-exports these.

export enum ItemTypes {
    CONTENT_OBJECT = 'ContentObject',
    COLLECTION = 'Collection',
    METADATA = 'Metadata',
    STORAGE_OBJECT = 'StorageObject',
    FILE = 'File',
}

export interface BaseItem {
    kind: ItemTypes;
}

export interface ContentObjectSourceItem extends BaseItem {
    kind: ItemTypes.CONTENT_OBJECT | ItemTypes.FILE;
    object_id?: string;
    data: CreateContentObjectPayload;
    options: {
        collection_id?: string;
    };
}

export interface CollectionSourceItem extends BaseItem {
    kind: ItemTypes.COLLECTION;
    object_id?: string;
    data: CreateCollectionPayload;
}

export interface MetadataSourceItem extends BaseItem {
    kind: ItemTypes.METADATA;
    object_id?: string;
    data: Omit<CreateContentObjectPayload, 'content'>;
    options: {
        collection_id?: string;
    };
}

export interface StorageObjectSourceItem extends BaseItem {
    kind: ItemTypes.STORAGE_OBJECT;
    filename: string;
    targetPath: string;
    sourceUrl: string;
    mimeType: string;
}

export type SourceItem = ContentObjectSourceItem | CollectionSourceItem | MetadataSourceItem | StorageObjectSourceItem;

export interface ImportedSourceItem<T extends BaseItem = SourceItem> {
    id: string;
    item: T;
    isUpdate: boolean;
}

/**
 * An external system the import reads its items from, page by page, instead of a JSON manifest object.
 * `source_id` is a source registered in the project (for SharePoint, `POST /sharepoint-sources`).
 */
export interface BulkImportSource {
    type: 'sharepoint';
    source_id: string;
}

/**
 * How an item finds the existing object it updates. `default` tries the item's `object_id`, then its
 * `content.source` when `updateByContentSource` is set, then its name and location. `contentSource`
 * matches by `content.source` only, so an item never updates an unrelated object with the same name.
 */
export type BulkImportMatchBy = 'default' | 'contentSource';

export interface BulkImportParams {
    maxConcurrentBatches?: number;
    maxConcurrentPartitions?: number;
    batchSize?: number;
    partitionSize?: number;
    dryRun?: boolean;
    updateByContentSource?: boolean;
    /**
     * Read items from an external source, page by page, instead of the manifest object in `objectIds`.
     * Each page is imported as it is read. A source sets `matchBy`, `skipUnchangedContent` and
     * `collectionId` itself.
     */
    source?: BulkImportSource;
    /** Defaults to `default`. */
    matchBy?: BulkImportMatchBy;
    /** Adds every created object to this collection. */
    collectionId?: string;
    /**
     * When an item matches an existing object and both carry the same `content.etag`, update only the
     * other fields so the object is not processed again. Without both etags, the content is updated.
     */
    skipUnchangedContent?: boolean;
    /** @deprecated Events are now always emitted. This suppresses the Temporal-backed delivery targets (workflow, agent, and process) — webhook deliveries still fire. */
    skipWorkflows?: boolean;
    /**
     * Processing priority for the document-processing workflows triggered by created objects.
     * Defaults to `low` so bulk imports run on the low-priority ("bulk") task queue and don't
     * compete with interactive traffic.
     */
    processingPriority?: ContentObjectProcessingPriority;
}

export interface PartitionError {
    partitionIndex: number;
    errorCount: number;
    /** Workflow-level error message if the partition itself failed (vs. per-batch failures). */
    message?: string;
    category?: BulkImportFailureCategory;
}

export type BulkImportOutcome = 'completed' | 'partial' | 'failed';
export type BulkImportFailureCategory = 'item' | 'infrastructure';

export interface BulkImportResult {
    outcome: BulkImportOutcome;
    totalItems: number;
    processedItems: number;
    createdItems: number;
    updatedItems: number;
    totalBatches: number;
    completedBatches: number;
    errors: PartitionError[];
    resultUri: string;
}

export interface BatchError {
    batchIndex: number;
    index: number;
    item: SourceItem;
    msg: string;
    category: BulkImportFailureCategory;
}

export interface AssembledResults {
    importedItems: ImportedSourceItem[];
    errors: BatchError[];
}
