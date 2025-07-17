import { ExecutionRunStatus } from './interaction.js';
import { SupportedEmbeddingTypes } from './project.js';
import { CollectionSearchPayload } from './store/collections.js';

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

export interface VectorSearchQuery {
    objectId?: string;
    values?: number[];
    text?: string;
    image?: string;
    threshold?: number;
    type: SupportedEmbeddingTypes
}

export interface SimpleSearchQuery {
    name?: string;
    status?: string | string[];
}

export interface ObjectSearchQuery extends SimpleSearchQuery {
    createdFrom?: string;
    createdTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    location?: string;
    parent?: string;
    similarTo?: string;
    embeddingType?: SupportedEmbeddingTypes;
    type?: string;
    types?: string[];
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