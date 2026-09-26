import type { ContentObjectProcessingPriority } from './store/store.js';
import type * as Wire from './wire-types.generated.js';

export type FindPayload = Wire.FindPayload;

export type GenericCommandResponse = Wire.GenericCommandResponse;

/**
 * Derived from `DeleteByIdResultSchema`. Shared by eight studio delete endpoints; only `DeleteUser`
 * publishes it canonically so far, and the generator fails the build if the canonical and derived
 * definitions ever differ.
 */
export type DeleteByIdResult = Wire.DeleteByIdResult;

export type DeleteCountResult = Wire.DeleteCountResult;

/**
 * The success acknowledgement the OAuth provider and client endpoints return, inferred from
 * `./api-schemas/oauth.js`.
 *
 * `success: boolean`, not `success: true`, which is what the document has always published — the
 * scanner widened the literal on its way out. The handlers still only ever return `true`; the type
 * now says what a client can be sent rather than what our five handlers happen to send.
 */
export type SuccessResponse = Wire.SuccessResponse;

/**
 * The raw Mongo delete acknowledgement, inferred from `./api-schemas/apikey.js`.
 *
 * One slot returns it (`DeleteApiKey`), so unlike {@link CountResult} it did not have to move as a
 * group — it is here rather than in an apikey module because `./common.js` is where the shared
 * result shapes live.
 */
export type DeleteOperationResult = Wire.DeleteOperationResult;

/**
 * How many rows an operation touched, inferred from `./api-schemas/project.js`.
 *
 * The module that owns it is named for the batch that converted it, not for the only resource that
 * uses it: four slots across three resources and two services return this.
 */
export type CountResult = Wire.CountResult;

export type BulkOperationPayload = Wire.BulkOperationPayload;

export type BulkOperationResult = Wire.BulkOperationResult;

export type BulkObjectDeleteResult = Wire.BulkObjectDeleteResult;

export type BulkObjectUpdateResult = Wire.BulkObjectUpdateResult;

export type BulkObjectCreateResult = Wire.BulkObjectCreateResult;

export interface BulkObjectCreateOptions {
    collection_id?: string;
    /** @deprecated Events are now always emitted. This suppresses Temporal-backed delivery targets. */
    skip_workflows?: boolean;
    processing_priority?: ContentObjectProcessingPriority;
    /** Stable identity for retrying an ambiguous bulk-create request without duplicating objects. */
    idempotency_key?: string;
}

export interface BulkObjectUpdateOptions {
    processing_priority?: ContentObjectProcessingPriority;
    /** Stable identity for retrying an ambiguous bulk-update request without duplicating events. */
    idempotency_key?: string;
}

export type BulkOperationResponse = Wire.BulkOperationResponse;

export type RunMigrationPayload = Wire.RunMigrationPayload;

export type RunMigrationResponse = Wire.RunMigrationResponse;

export type MigrationListResponse = Wire.MigrationListResponse;
