import { ExecutionRunStatus } from './interaction.js';
import { CollectionSearchPayload } from './store/collections.js';
import { SearchTypes, SupportedEmbeddingTypes } from "./project.js";

export type EmbeddingSearchConfig = Partial<Record<SupportedEmbeddingTypes, boolean>>;

export interface RunListingQueryOptions {
    project?: string;
    interaction?: string | string[];
    limit?: number;
    offset?: number;
    filters?: RunListingFilters;
}

export interface RunListingFilters {
    interaction?: string | string[],
    status?: ExecutionRunStatus,
    model?: string,
    environment?: string,
    tag?: string,
    fromDate?: string,
    toDate?: string,
    parent?: string | false,
    workflow_run_ids?: string[],
}

export type scoreAggregationTypes = 'rrf' | 'rsf' | 'smart';
export type dynamicScalingTypes = 'off' | 'on'; // Ignored when scoreAggregation is 'smart'

export interface VectorSearchQuery {
    objectId?: string;
    values?: number[];
    text?: string;
    image?: string;
    embeddingSearchTypes?: EmbeddingSearchConfig;
    weights?: Record<SearchTypes, number>
    fullText?: boolean;
    dynamicScaling?: dynamicScalingTypes;
    scoreAggregation?: scoreAggregationTypes;
}

export interface SimpleSearchQuery {
    name?: string;
    status?: string | string[];
    limit?: number;
    offset?: number;
}

export interface ObjectSearchQuery extends SimpleSearchQuery {
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
    matchInteractions?: boolean;
}

export interface InteractionSearchQuery extends SimpleSearchQuery {
    prompt?: string;
    tags?: string[];
    version?: string;
}

export interface RunSearchQuery extends SimpleSearchQuery {
    offset?: number;
    interaction?: string;
    environment?: string;
    model?: string;
    status?: ExecutionRunStatus;
    tags?: string[];
    query?: string;
    default_query_path?: string;
    parent?: string[] | false;
    object?: string;
    start?: string;
    end?: string;
    finish_reason?: string;
    created_by?: string;
    workflow_run_ids?: string[];
}

export interface WorkflowExecutionSearchQuery extends SimpleSearchQuery {
    documentId?: string;
    eventName?: string;
    ruleId?: string;
    start?: string;
    end?: string;
    status?: string;
}

export interface ComplexSearchQuery extends ObjectSearchQuery {
    vector?: VectorSearchQuery;
    match?: Record<string, any>;
}

export interface ComplexCollectionSearchQuery extends CollectionSearchPayload {
    match?: Record<string, any>;
}

/*
export interface ComplexSearchQuery extends ObjectSearchQuery {
    vector?: VectorSearchQuery;
    fullText?: string;  // If present, do full text search
    match?: Record<string, any>;
    weights?: Record<SearchTypes, number>;  // Move weights to top level
    dynamicScaling?: dynamicScalingTypes;   // Move to top level
    scoreAggregation?: scoreAggregationTypes; // Move to top level
}

export interface VectorSearchQuery {
    objectId?: string;
    values?: number[];
    text?: string;  // Only for vector embedding generation
    image?: string;
    embeddingSearchTypes?: EmbeddingSearchConfig;
    // Remove: weights, fullText, dynamicScaling, scoreAggregation
}
*/