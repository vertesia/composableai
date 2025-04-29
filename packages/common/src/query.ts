import { ExecutionRunStatus } from './interaction.js';
import { SupportedEmbeddingTypes } from './project.js';

export interface RunListingQueryOptions {
    project?: string;
    interaction?: string;
    limit?: number;
    offset?: number;
    filters?: RunListingFilters;
}

export interface RunListingFilters {
    interaction?: string,
    status?: ExecutionRunStatus,
    model?: string,
    environment?: string,
    tag?: string,
    fromDate?: string,
    toDate?: string,
    parent?: string | false,
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
    status?: string;
}

export interface ObjectSearchQuery extends SimpleSearchQuery {
    location?: string;
    parent?: string;
    similarTo?: string;
    embeddingType?: SupportedEmbeddingTypes;
    type?: string;
}

export interface ObjectTypeSearchQuery extends SimpleSearchQuery {
    chunckable?: boolean;
}

export interface PromptSearchQuery extends SimpleSearchQuery {
    role?: string;
    matchInteractions?: boolean;
}

export interface InteractionSearchQuery extends SimpleSearchQuery {
    prompt?: string;
    tags?: string[];
    version?: number;
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