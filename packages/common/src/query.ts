import type { ExecutionRunStatus } from './interaction.js';
import type * as Wire from './wire-types.generated.js';

export type EmbeddingSearchConfig = Wire.EmbeddingSearchConfig;

export interface RunListingQueryOptions {
    project?: string;
    interaction?: string | string[];
    limit?: number;
    offset?: number;
    filters?: RunListingFilters;
}

/**
 * The filters `RunsApi.list` puts on the query string of `GET /runs`.
 *
 * Kept as hand-written scalars-or-arrays rather than inferred from `RunListQuerySchema`: this is what
 * a caller writes, and the published component is what goes over the wire after the client serializes
 * it. A single value and a one-element array are the same request.
 */
export interface RunListingFilters {
    interaction?: string | string[];
    status?: ExecutionRunStatus | ExecutionRunStatus[];
    model?: string | string[];
    environment?: string | string[];
    tag?: string | string[];
    /** @deprecated Never applied by `GET /runs`. Sent and ignored; use `POST /runs/search` for a date range. */
    fromDate?: string;
    /** @deprecated Never applied by `GET /runs`. Sent and ignored; use `POST /runs/search` for a date range. */
    toDate?: string;
    parent?: string | string[];
    is_root?: boolean;
    workflow_run_ids?: string[];
    workflow_ids?: string[];
}

export type scoreAggregationTypes = Wire.scoreAggregationTypes;
export type dynamicScalingTypes = Wire.dynamicScalingTypes;

export type VectorSearchQuery = Wire.VectorSearchQuery;

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

export type PromptSearchQuery = Wire.PromptSearchQuery;

export type InteractionSearchQuery = Wire.InteractionSearchQuery;

export type RunSearchQuery = Wire.RunSearchQuery;

export type ComplexSearchQuery = Wire.ComplexSearchQuery;

export type ComplexCollectionSearchQuery = Wire.ComplexCollectionSearchQuery;
