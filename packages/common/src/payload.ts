import type { z } from 'zod';
import type {
    ComputeCollectionFacetPayloadSchema,
    ComputeObjectFacetPayloadSchema,
    ExportPropertiesPayloadSchema,
    ExportPropertiesResponseSchema,
} from './api-schemas/content.js';
import type {
    ComputeInteractionFacetPayloadSchema,
    ComputeRunFacetPayloadSchema,
    RunSearchPayloadSchema,
    SortOptionSchema,
    SortOrderSchema,
} from './api-schemas/interaction.js';
import type { ComputePromptFacetPayloadSchema } from './api-schemas/prompt.js';
import type { FacetSpec } from './facets.js';
import type {
    InteractionSearchQuery,
    ObjectSearchQuery,
    ObjectTypeSearchQuery,
    PromptSearchQuery,
    SimpleSearchQuery,
} from './query.js';

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

export type ComputeCollectionFacetPayload = z.infer<typeof ComputeCollectionFacetPayloadSchema>;

export type ComputeInteractionFacetPayload = z.infer<typeof ComputeInteractionFacetPayloadSchema>;

export type ComputeObjectFacetPayload = z.infer<typeof ComputeObjectFacetPayloadSchema>;

export type ComputePromptFacetPayload = z.infer<typeof ComputePromptFacetPayloadSchema>;

export type ComputeRunFacetPayload = z.infer<typeof ComputeRunFacetPayloadSchema>;

export type ExportPropertiesPayload = z.infer<typeof ExportPropertiesPayloadSchema>;

export type ExportPropertiesResponse = z.infer<typeof ExportPropertiesResponseSchema>;
