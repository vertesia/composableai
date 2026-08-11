import type { z } from 'zod';
import type {
    ComplexCollectionSearchQuerySchema,
    ComplexSearchQuerySchema,
    dynamicScalingTypesSchema,
    EmbeddingSearchConfigSchema,
    scoreAggregationTypesSchema,
    VectorSearchQuerySchema,
} from './api-schemas/content.js';
import type { InteractionSearchQuerySchema, RunSearchQuerySchema } from './api-schemas/interaction.js';
import type { PromptSearchQuerySchema } from './api-schemas/prompt.js';
import type { ExecutionRunStatus } from './interaction.js';

export type EmbeddingSearchConfig = z.infer<typeof EmbeddingSearchConfigSchema>;

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

export type scoreAggregationTypes = z.infer<typeof scoreAggregationTypesSchema>;
export type dynamicScalingTypes = z.infer<typeof dynamicScalingTypesSchema>;

export type VectorSearchQuery = z.infer<typeof VectorSearchQuerySchema>;

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

export type PromptSearchQuery = z.infer<typeof PromptSearchQuerySchema>;

export type InteractionSearchQuery = z.infer<typeof InteractionSearchQuerySchema>;

export type RunSearchQuery = z.infer<typeof RunSearchQuerySchema>;

export type ComplexSearchQuery = z.infer<typeof ComplexSearchQuerySchema>;

export type ComplexCollectionSearchQuery = z.infer<typeof ComplexCollectionSearchQuerySchema>;
