import type { z } from 'zod';
import type { InteractionSearchQuerySchema, RunSearchQuerySchema } from './api-schemas/interaction.js';
import type { ExecutionRunStatus } from './interaction.js';
import type { SearchTypes, SupportedEmbeddingTypes } from './project.js';
import type { CollectionSearchPayload } from './store/collections.js';

export type EmbeddingSearchConfig = Partial<Record<SupportedEmbeddingTypes, boolean>>;

export interface RunListingQueryOptions {
    project?: string;
    interaction?: string | string[];
    limit?: number;
    offset?: number;
    filters?: RunListingFilters;
}

export interface RunListingFilters {
    interaction?: string | string[];
    status?: ExecutionRunStatus;
    model?: string;
    environment?: string;
    tag?: string;
    fromDate?: string;
    toDate?: string;
    parent?: string | string[];
    is_root?: boolean;
    workflow_run_ids?: string[];
}

export type scoreAggregationTypes = 'rrf' | 'rsf' | 'smart';
export type dynamicScalingTypes = 'off' | 'on';

export interface VectorSearchQuery {
    objectId?: string;
    values?: number[];
    text?: string;
    image?: string;
    config?: EmbeddingSearchConfig;
}

export interface SimpleSearchQuery {
    name?: string;
    status?: string | string[];
    limit?: number;
    offset?: number;
}

export interface ObjectSearchQuery extends SimpleSearchQuery {
    id?: string;
    ids?: string[];
    createdFrom?: string;
    createdTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    location?: string;
    parent?: string;
    type?: string;
    types?: string[];
    all_revisions?: boolean;
    from_root?: string;
}

export interface ObjectTypeSearchQuery extends SimpleSearchQuery {
    chunkable?: boolean;
}

export interface PromptSearchQuery extends SimpleSearchQuery {
    role?: string;
    tags?: string[];
    matchInteractions?: boolean;
}

export type InteractionSearchQuery = z.infer<typeof InteractionSearchQuerySchema>;

export type RunSearchQuery = z.infer<typeof RunSearchQuerySchema>;

export interface WorkflowExecutionSearchQuery extends SimpleSearchQuery {
    documentId?: string;
    eventName?: string;
    ruleId?: string;
    start?: string;
    end?: string;
    status?: string;
}

/**
 * ComplexSearchQuery is used for full-text search and vector embedding search.
 */
export interface ComplexSearchQuery extends ObjectSearchQuery {
    vector?: VectorSearchQuery;

    /**
     * If present, do a full text search (snake_case version).
     */
    full_text?: string;

    weights?: Record<SearchTypes, number>;

    /**
     * dynamicScaling rescales the weights when a particular search type is not present in the results, per object.
     * e.g. Weights of 5,3,2 will be treated as 0,3,2 if the first search type is not present in the results.
     * Ignored when scoreAggregation is 'smart'
     * Default is 'on'
     */
    dynamic_scaling?: dynamicScalingTypes; // Move to top level

    /**
     * rrf: Reciprocal Rank Fusion
     * rsf: Reciprocal Score Fusion
     * smart: Our own algorithm (default and recommended)
     */
    score_aggregation?: scoreAggregationTypes;

    match?: Record<string, unknown>;
}

export interface ComplexCollectionSearchQuery extends CollectionSearchPayload {
    match?: Record<string, unknown>;
}
