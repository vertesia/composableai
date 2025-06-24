import { FacetSpec } from "./facets.js";
import {
    ComplexSearchQuery,
    InteractionSearchQuery,
    ObjectSearchQuery,
    ObjectTypeSearchQuery,
    PromptSearchQuery,
    RunSearchQuery,
    SimpleSearchQuery
} from "./query.js";

export interface SearchPayload {
    query?: SimpleSearchQuery;
    limit?: number;
    offset?: number;
    select?: string;
    all_revisions?: boolean;
    from_root?: string;
}

export interface ComputeFacetPayload {
    facets: FacetSpec[];
    query?: SimpleSearchQuery;
}

export interface ConversationSearchPayload {
    start?: string;
    end?: string;
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

export interface RunSearchPayload extends SearchPayload {
    query?: RunSearchQuery;
}

export interface ComputeInteractionFacetPayload extends ComputeFacetPayload {
    query?: InteractionSearchQuery;
}

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
}

export interface ExportPropertiesResponse {
    type: string;
    name: string;
    data: Blob;
}
