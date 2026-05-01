import type {
    CreateCollectionPayload,
    CreateContentObjectPayload,
} from '@vertesia/common';

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

export type SourceItem =
    | ContentObjectSourceItem
    | CollectionSourceItem
    | MetadataSourceItem
    | StorageObjectSourceItem;

export interface SourceItemBatch {
    index: number;
    files: SourceItem[];
}

export interface SourceItemBatches {
    batches: SourceItemBatch[];
}

export interface BatchGenerationParams {
    batchSize?: number;
    startPosition: number;
    endPosition: number;
}

export interface ImportedSourceItem<T extends BaseItem = SourceItem> {
    id: string;
    item: T;
    isUpdate: boolean;
}

export interface PartitionGenerationParams {
    partitionSize: number;
}

export interface Partition {
    size: number;
    startPosition: number;
    endPosition: number;
}

export interface Partitions {
    totalSize: number;
    partitions: Partition[];
}

export interface BulkImportParams {
    maxConcurrentBatches?: number;
    maxConcurrentPartitions?: number;
    batchSize?: number;
    partitionSize?: number;
    dryRun?: boolean;
    updateByContentSource?: boolean;
}

export interface PartitionError {
    partitionIndex: number;
    errorCount: number;
}

export interface BulkImportResult {
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
}

export interface AssembledResults {
    importedItems: ImportedSourceItem[];
    errors: BatchError[];
}
