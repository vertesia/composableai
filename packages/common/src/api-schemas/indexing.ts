import { z } from 'zod';
import { WorkflowExecutionStatusSchema } from './document-processing.js';
import { ElasticsearchBackendSchema, ProjectSearchTierSchema } from './project-configuration.js';

const nullableStringSchema: z.ZodType<string | null> = z.any().meta({ type: ['string', 'null'] });
const nullableNumberSchema: z.ZodType<number | null> = z.any().meta({ type: ['number', 'null'] });

export const StartProjectReindexPayloadSchema = z
    .strictObject({
        shard_size: z.number().optional(),
        parallel_shard_count: z.number().optional(),
        concurrency: z.number().optional(),
        bulk_size_bytes: z.number().optional(),
        bulk_concurrency: z.number().optional(),
        modified_since: z
            .string()
            .meta({
                format: 'date-time',
                description:
                    'When set, reindex only documents whose updated_at is at or after this RFC3339/ISO-8601 ' +
                    'datetime. Writes in-place into the live index (no new versioned target, no alias swap). ' +
                    'Omit for a full reindex into a fresh versioned target.',
            })
            .optional(),
    })
    .meta({ id: 'StartProjectReindexPayload' });

export const ReindexAgentRunsResponseSchema = z
    .strictObject({
        status: z.string(),
        backend: ElasticsearchBackendSchema,
        index_name: z.string(),
        recreated: z.boolean(),
        total: z.number(),
        scanned: z.number(),
        indexed: z.number(),
        failed: z.number(),
        errors: z
            .array(
                z.strictObject({
                    id: z.string(),
                    message: z.string(),
                }),
            )
            .optional(),
    })
    .meta({ id: 'ReindexAgentRunsResponse' });

export const ReindexAgentRunsPayloadSchema = z
    .strictObject({
        recreate_index: z
            .boolean()
            .meta({
                description:
                    'Drop any existing agent-runs index/alias family and recreate the stable concrete index before indexing. Defaults to true.',
            })
            .optional(),
        batch_size: z
            .number()
            .meta({ description: 'Number of MongoDB records to scan per batch. Defaults to 500.' })
            .optional(),
        limit: z
            .number()
            .meta({
                description: 'Optional cap for partial/manual repair runs. Omit for all agent runs in the project.',
            })
            .optional(),
    })
    .meta({ id: 'ReindexAgentRunsPayload' });

export const IndexingStatusResponseSchema = z
    .strictObject({
        infrastructure_enabled: z
            .boolean()
            .meta({ description: 'Whether indexing infrastructure is available globally' }),
        indexing_enabled: z.boolean().meta({ description: 'Whether indexing is enabled for this project' }),
        query_enabled: z.boolean().meta({
            description:
                'Deprecated: Now derived from indexing_enabled - queries automatically route to index when indexing is enabled',
            deprecated: true,
            'x-deprecated-message':
                'Now derived from indexing_enabled - queries automatically route to index when indexing is enabled',
        }),
        backend: ElasticsearchBackendSchema.meta({
            description: 'Resolved Elasticsearch backend serving this project',
        }),
        search_tier: ProjectSearchTierSchema.meta({ description: 'Resolved search tier for this project' }),
        index: z
            .strictObject({
                exists: z.boolean().meta({ description: 'Whether the index exists' }),
                alias_name: z.string().meta({ description: 'Alias name (used for queries)' }),
                index_name: z.string().meta({ description: 'Actual index name (versioned)' }),
                version: z.number().meta({ description: 'Index version (timestamp when created)' }),
                created_at: nullableStringSchema.meta({ description: 'When the current index was created' }),
                document_count: z.number().meta({ description: 'Number of documents in the index' }),
                size_bytes: z.number().meta({ description: 'Index size in bytes' }),
            })
            .meta({ description: 'Index status' }),
        mongo_document_count: z.number().meta({ description: 'MongoDB document count for comparison' }),
        reindex_in_progress: z.boolean().meta({ description: 'Whether a reindex is currently in progress' }),
        reindex_progress: z
            .strictObject({
                total_shards: z.number().meta({ description: 'Total shards to process' }),
                completed_shards: z.number().meta({ description: 'Shards completed so far' }),
                failed_shards: z.number().meta({ description: 'Shards that failed' }),
                status: z
                    .string()
                    .meta({ description: 'Current status (e.g., "computing_shards", "indexing", "completed")' }),
                scanned: z.number().meta({ description: 'Documents scanned from source' }),
                written: z.number().meta({ description: 'Documents written to target index' }),
                errors: z.number().meta({ description: 'Documents that failed to index' }),
                embeddings_written: z
                    .number()
                    .meta({ description: 'Embedding vectors written to target index' })
                    .optional(),
                skipped_embeddings: z
                    .number()
                    .meta({
                        description: 'Embedding vectors skipped because they were invalid or dimension-mismatched',
                    })
                    .optional(),
                embeddings_text_written: z
                    .number()
                    .meta({ description: 'Text embedding vectors written to target index' })
                    .optional(),
                embeddings_image_written: z
                    .number()
                    .meta({ description: 'Image embedding vectors written to target index' })
                    .optional(),
                embeddings_properties_written: z
                    .number()
                    .meta({ description: 'Properties embedding vectors written to target index' })
                    .optional(),
                embeddings_text_skipped: z
                    .number()
                    .meta({
                        description: 'Text embedding vectors skipped because they were invalid or dimension-mismatched',
                    })
                    .optional(),
                embeddings_image_skipped: z
                    .number()
                    .meta({
                        description:
                            'Image embedding vectors skipped because they were invalid or dimension-mismatched',
                    })
                    .optional(),
                embeddings_properties_skipped: z
                    .number()
                    .meta({
                        description:
                            'Properties embedding vectors skipped because they were invalid or dimension-mismatched',
                    })
                    .optional(),
                properties_values_trimmed: z
                    .number()
                    .meta({
                        description: 'Oversized property string values dropped during transform (size-based pruning)',
                    })
                    .optional(),
                properties_bytes_dropped: z
                    .number()
                    .meta({ description: 'Total bytes dropped from oversized property values' })
                    .optional(),
                batches_flushed: z
                    .number()
                    .meta({ description: 'Total batcher flushes across all completed shards (cumulative)' })
                    .optional(),
                bulk_chunks_written: z
                    .number()
                    .meta({ description: 'Total ES bulk requests sent across all completed shards (cumulative)' })
                    .optional(),
                bulk_errors: z
                    .number()
                    .meta({
                        description:
                            "Total per-document ES bulk-item failures across all shards (cumulative). Counts docs ES rejected — they aren't in the indexed set.",
                    })
                    .optional(),
                avg_docs_per_batch: z
                    .number()
                    .meta({
                        description:
                            'Average documents per batch flush (written / batches_flushed) — useful to spot under/over-batching',
                    })
                    .optional(),
                avg_chunks_per_batch: z
                    .number()
                    .meta({
                        description:
                            'Average chunks per batch (>1 means bulk_size_bytes cap is splitting batches frequently)',
                    })
                    .optional(),
                docs_per_second: z.number().meta({ description: 'Documents processed per second' }),
                elapsed_seconds: z.number().meta({ description: 'Elapsed time in seconds' }),
                estimated_seconds_remaining: nullableNumberSchema.meta({
                    description: 'Estimated seconds remaining (null if unknown)',
                }),
                percent_complete: z.number().meta({ description: 'Percentage complete (0-100)' }),
                alias: z.string().meta({ description: 'Source alias' }),
                target_index: z.string().meta({ description: 'Target index name' }),
            })
            .meta({ description: 'Reindex progress (if reindex is in progress)' })
            .optional(),
    })
    .meta({ id: 'IndexingStatusResponse', description: 'Response from indexing status endpoint' });

export const DriftAnalysisResultSchema = z
    .strictObject({
        total: z.number(),
        processed: z.number(),
        missing: z.number(),
        stale: z.number(),
        sample_missing_ids: z.array(z.string()),
        sample_stale_ids: z.array(z.string()),
        completed_at: z.string(),
    })
    .meta({ id: 'DriftAnalysisResult' });

export const DriftAnalysisProgressSchema = z
    .strictObject({
        total: z.number(),
        processed: z.number(),
        missing: z.number(),
        stale: z.number(),
        status: z.string(),
        current_batch: z.number(),
        total_batches: z.number(),
        percent_complete: z.number(),
        docs_per_second: z.number(),
        elapsed_seconds: z.number(),
        estimated_seconds_remaining: nullableNumberSchema,
    })
    .meta({ id: 'DriftAnalysisProgress' });

export const DriftAnalysisStatusResponseSchema = z
    .strictObject({
        workflow_id: nullableStringSchema,
        workflow_run_id: nullableStringSchema,
        status: WorkflowExecutionStatusSchema,
        progress: DriftAnalysisProgressSchema.optional(),
        result: DriftAnalysisResultSchema.optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'DriftAnalysisStatusResponse' });
