import { FacetResult } from './facets.js';
import { NamedInteractionExecutionPayload } from './interaction.js';

/**
 * The run ref is used to identify a run document in the storage
 */
export interface ExecutionRunDocRef {
    id: string,
    account: string,
    project: string,
}

/**
 * Interaction execution payload for creating a new run
 * It uses interaction field (from NamedInteractionExecutionPayload) to pass the intercation ID to run
 */
export interface RunCreatePayload extends NamedInteractionExecutionPayload {
}

/**
 * To be used as a value for a numeric or date filters
 */
export interface RangeValue {
    gt?: number | string,
    gte?: number | string,
    lt?: number | string,
    lte?: number | string,
}

export interface RunSearchMetaRepsonse {
    count: {
        lower_bound?: number,
        total?: number,
    },
    facet: Record<string, FacetResult>
}
