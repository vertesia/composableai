import type * as Wire from './wire-types.generated.js';

/**
 * The run ref is used to identify a run document in the storage
 */
export type ExecutionRunDocRef = Wire.ExecutionRunDocRef;
export type FindRunResult = Wire.FindRunResult;
export type FindRunResultArray = Wire.FindRunResultArray;
export type PopulatedExecutionRunResult = Wire.PopulatedExecutionRunResult;

/**
 * Interaction execution payload for creating a new run
 * It uses interaction field (from NamedInteractionExecutionPayload) to pass the interaction ID to run
 */
export type RunCreatePayload = Wire.RunCreatePayload;

/**
 * Payload for cloning an existing ExecutionRun.
 * Creates a new run document with the same interaction/config but fresh status.
 * Used by fork flows to create a new ExecutionRun for the forked workflow.
 */
export type RunClonePayload = Wire.RunClonePayload;

/**
 * To be used as a value for a numeric or date filters
 */
export interface RangeValue {
    gt?: number | string;
    gte?: number | string;
    lt?: number | string;
    lte?: number | string;
}

export type RunSearchMetaResponse = Wire.RunSearchMetaResponse;
export type ComputeRunFacetsResponse = Wire.ComputeRunFacetsResponse;
