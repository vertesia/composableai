import type { z } from 'zod';
import type {
    ComputeRunFacetsResponseSchema,
    ExecutionRunDocRefSchema,
    FindRunResultArraySchema,
    FindRunResultSchema,
    PopulatedExecutionRunResultSchema,
    RunClonePayloadSchema,
    RunCreatePayloadSchema,
    RunSearchMetaResponseSchema,
} from './api-schemas/interaction.js';

/**
 * The run ref is used to identify a run document in the storage
 */
export type ExecutionRunDocRef = z.infer<typeof ExecutionRunDocRefSchema>;
export type FindRunResult = z.infer<typeof FindRunResultSchema>;
export type FindRunResultArray = z.infer<typeof FindRunResultArraySchema>;
export type PopulatedExecutionRunResult = z.infer<typeof PopulatedExecutionRunResultSchema>;

/**
 * Interaction execution payload for creating a new run
 * It uses interaction field (from NamedInteractionExecutionPayload) to pass the interaction ID to run
 */
export type RunCreatePayload = z.infer<typeof RunCreatePayloadSchema>;

/**
 * Payload for cloning an existing ExecutionRun.
 * Creates a new run document with the same interaction/config but fresh status.
 * Used by fork flows to create a new ExecutionRun for the forked workflow.
 */
export type RunClonePayload = z.infer<typeof RunClonePayloadSchema>;

/**
 * To be used as a value for a numeric or date filters
 */
export interface RangeValue {
    gt?: number | string;
    gte?: number | string;
    lt?: number | string;
    lte?: number | string;
}

export type RunSearchMetaResponse = z.infer<typeof RunSearchMetaResponseSchema>;
export type ComputeRunFacetsResponse = z.infer<typeof ComputeRunFacetsResponseSchema>;
