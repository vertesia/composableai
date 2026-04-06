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
 * It uses interaction field (from NamedInteractionExecutionPayload) to pass the interaction ID to run
 */
export interface RunCreatePayload extends NamedInteractionExecutionPayload {
}

/**
 * Payload for cloning an existing ExecutionRun.
 * Creates a new run document with the same interaction/config but fresh status.
 * Used by fork flows to create a new ExecutionRun for the forked workflow.
 */
export interface RunClonePayload {
    /** The _id of the source ExecutionRun to clone */
    source_run_id: string;
    /** Temporal workflow reference for the new run */
    workflow: {
        run_id: string;
        workflow_id: string;
    };
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

export interface RunSearchMetaResponse {
    count: {
        lower_bound?: number,
        total?: number,
    },
    facet: Record<string, FacetResult>
}
