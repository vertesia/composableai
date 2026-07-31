import type { z } from 'zod';
import type { DeleteOperationResultSchema } from './api-schemas/apikey.js';
import type { CountResultSchema } from './api-schemas/project.js';
import type { DeleteByIdResultSchema } from './api-schemas/user.js';
export interface FindPayload {
    query: Record<string, unknown>;
    offset?: number;
    limit?: number;
    select?: string;
    all_revisions?: boolean;
    from_root?: string;
}

export interface GenericCommandResponse {
    status: string;
    message: string;
    err?: unknown;
    details?: unknown;
}

/**
 * Derived from `DeleteByIdResultSchema`. Shared by eight studio delete endpoints; only `DeleteUser`
 * publishes it canonically so far, and the generator fails the build if the canonical and derived
 * definitions ever differ.
 */
export type DeleteByIdResult = z.infer<typeof DeleteByIdResultSchema>;

export interface DeleteCountResult {
    id: string;
    count: number;
}

export interface SuccessResponse {
    success: true;
}

/**
 * The raw Mongo delete acknowledgement, inferred from `./api-schemas/apikey.js`.
 *
 * One slot returns it (`DeleteApiKey`), so unlike {@link CountResult} it did not have to move as a
 * group — it is here rather than in an apikey module because `./common.js` is where the shared
 * result shapes live.
 */
export type DeleteOperationResult = z.infer<typeof DeleteOperationResultSchema>;

/**
 * How many rows an operation touched, inferred from `./api-schemas/project.js`.
 *
 * The module that owns it is named for the batch that converted it, not for the only resource that
 * uses it: four slots across three resources and two services return this.
 */
export type CountResult = z.infer<typeof CountResultSchema>;

export interface BulkOperationPayload {
    /**
     * The operation name
     */
    name: 'change_type' | 'create' | 'delete' | 'start_workflow' | 'update';

    /**
     * The IDs of the objects to operate on
     */
    ids: string[];

    /**
     * The operation parameters.
     */
    params: Record<string, unknown>;
}

export interface BulkOperationResult<TOperation extends string = 'generic'> {
    operation: TOperation;
    status: 'in_progress' | 'completed' | 'failed';
}

export interface BulkObjectDeleteResult extends BulkOperationResult<'delete'> {
    operation: 'delete';
    /** Number of documents deleted (including revisions) */
    deleted: number;
    /** IDs that were not found or user had no permission to delete */
    failed: string[];
}

export interface BulkObjectUpdateResult extends BulkOperationResult<'update'> {
    operation: 'update';
    /** Number of documents successfully updated */
    updated: number;
    /** IDs that were not found, not authorized, or failed to update */
    failed: string[];
}

export interface BulkObjectCreateResult extends BulkOperationResult<'create'> {
    operation: 'create';
    /** Number of documents successfully created */
    created: number;
    /** Successfully created objects with their IDs */
    objects: { id: string; external_id?: string }[];
    /** Objects that failed to create */
    failed: { external_id?: string; index: number; error: string }[];
}

/**
 * @discriminator operation
 */
export type BulkOperationResponse =
    | BulkOperationResult
    | BulkObjectCreateResult
    | BulkObjectUpdateResult
    | BulkObjectDeleteResult;
