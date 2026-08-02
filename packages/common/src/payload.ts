import type { z } from 'zod';
import type {
    ComputeInteractionFacetPayloadSchema,
    RunSearchPayloadSchema,
    SortOptionSchema,
    SortOrderSchema,
} from './api-schemas/interaction.js';
import type { FacetSpec } from './facets.js';
import type {
    ComplexCollectionSearchQuery,
    ComplexSearchQuery,
    InteractionSearchQuery,
    ObjectSearchQuery,
    ObjectTypeSearchQuery,
    PromptSearchQuery,
    RunSearchQuery,
    SimpleSearchQuery,
} from './query.js';
import type { ColumnLayout } from './store/store.js';

export type SortOrder = z.infer<typeof SortOrderSchema>;

export type SortOption = z.infer<typeof SortOptionSchema>;

export interface SearchPayload {
    facets?: FacetSpec[];
    /**
     * If the facets should be limited to the current page of results.
     * Defaults to false. When false, the facets are independent of the search results page.
     */
    limit_facets?: boolean;
    query?: SimpleSearchQuery;
    limit?: number;
    offset?: number;
    select?: string;
    all_revisions?: boolean;
    from_root?: string;
    /** Sort criteria. Multiple entries enable multi-field sorting (first entry is primary). */
    sort?: SortOption[];
    /** Arbitrary Elasticsearch aggregation definitions. Ignored when search falls back to MongoDB. */
    aggs?: Record<string, unknown>;
}

export interface ComputeFacetPayload {
    facets: FacetSpec[];
    query?: SimpleSearchQuery;
}

export interface InteractionSearchPayload extends SearchPayload {
    query?: InteractionSearchQuery;
}

export interface ObjectSearchPayload extends SearchPayload {
    query?: ObjectSearchQuery;
}

export interface ObjectTypeSearchPayload extends SearchPayload {
    query?: ObjectTypeSearchQuery;
}

export interface PromptSearchPayload extends SearchPayload {
    query?: PromptSearchQuery;
}

export type RunSearchPayload = z.infer<typeof RunSearchPayloadSchema>;

export interface ComputeCollectionFacetPayload extends Omit<ComputeFacetPayload, 'query'> {
    query?: ComplexCollectionSearchQuery;
}

export type ComputeInteractionFacetPayload = z.infer<typeof ComputeInteractionFacetPayloadSchema>;

export interface ComputeObjectFacetPayload extends ComputeFacetPayload {
    query?: ComplexSearchQuery;
}

export interface ComputePromptFacetPayload extends ComputeFacetPayload {
    query?: PromptSearchQuery;
}

export interface ComputeRunFacetPayload extends ComputeFacetPayload {
    query?: RunSearchQuery;
}

export interface ExportPropertiesPayload {
    objectIds: string[];
    type: string;
    query?: ComplexSearchQuery;
    table_layout?: ColumnLayout[];
}

export interface ExportPropertiesResponse {
    type: string;
    name: string;
    data: string;
}
