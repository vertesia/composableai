import type { SourceItem } from '@vertesia/common';

// The shapes a bulk import exchanges with its caller live in @vertesia/common. They are re-exported
// here so this entry point keeps its full surface; what follows is the workflow's internal batching.
export {
    type AssembledResults,
    type BaseItem,
    type BatchError,
    type BulkImportFailureCategory,
    type BulkImportOutcome,
    type BulkImportParams,
    type BulkImportResult,
    type CollectionSourceItem,
    type ContentObjectSourceItem,
    type ImportedSourceItem,
    ItemTypes,
    type MetadataSourceItem,
    type PartitionError,
    type SourceItem,
    type StorageObjectSourceItem,
} from '@vertesia/common';

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
