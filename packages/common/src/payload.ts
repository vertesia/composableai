import type { FacetSpec } from './facets.js';
import type {
    InteractionSearchQuery,
    ObjectSearchQuery,
    ObjectTypeSearchQuery,
    PromptSearchQuery,
    SimpleSearchQuery,
} from './query.js';
import type * as Wire from './wire-types.generated.js';

export type SortOrder = Wire.SortOrder;

export type SortOption = Wire.SortOption;

interface SearchPayload {
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

export type RunSearchPayload = Wire.RunSearchPayload;

export type ComputeCollectionFacetPayload = Wire.ComputeCollectionFacetPayload;

export type ComputeInteractionFacetPayload = Wire.ComputeInteractionFacetPayload;

export type ComputeObjectFacetPayload = Wire.ComputeObjectFacetPayload;

export type ComputePromptFacetPayload = Wire.ComputePromptFacetPayload;

export type ComputeRunFacetPayload = Wire.ComputeRunFacetPayload;

export type ExportPropertiesPayload = Wire.ExportPropertiesPayload;

export type ExportPropertiesResponse = Wire.ExportPropertiesResponse;
