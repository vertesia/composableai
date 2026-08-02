import type { z } from 'zod';
import type { DeleteOperationResultSchema } from './api-schemas/apikey.js';
import type {
    BulkObjectCreateResultSchema,
    BulkObjectDeleteResultSchema,
    BulkObjectUpdateResultSchema,
    BulkOperationPayloadSchema,
    BulkOperationResponseSchema,
    BulkOperationResultSchema,
} from './api-schemas/bulk-operation.js';
import type { DeleteCountResultSchema } from './api-schemas/commands.js';
import type { SuccessResponseSchema } from './api-schemas/oauth.js';
import type { CountResultSchema } from './api-schemas/project.js';
import type { DeleteByIdResultSchema } from './api-schemas/user.js';
import type { GenericCommandResponseSchema } from './api-schemas/zeno-commands.js';
import type { FindPayloadSchema } from './api-schemas/zeno-remaining.js';
import type { ContentObjectProcessingPriority } from './store/store.js';

export type FindPayload = z.infer<typeof FindPayloadSchema>;

export type GenericCommandResponse = z.infer<typeof GenericCommandResponseSchema>;

/**
 * Derived from `DeleteByIdResultSchema`. Shared by eight studio delete endpoints; only `DeleteUser`
 * publishes it canonically so far, and the generator fails the build if the canonical and derived
 * definitions ever differ.
 */
export type DeleteByIdResult = z.infer<typeof DeleteByIdResultSchema>;

export type DeleteCountResult = z.infer<typeof DeleteCountResultSchema>;

/**
 * The success acknowledgement the OAuth provider and client endpoints return, inferred from
 * `./api-schemas/oauth.js`.
 *
 * `success: boolean`, not `success: true`, which is what the document has always published — the
 * scanner widened the literal on its way out. The handlers still only ever return `true`; the type
 * now says what a client can be sent rather than what our five handlers happen to send.
 */
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

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

export type BulkOperationPayload = z.infer<typeof BulkOperationPayloadSchema>;

export type BulkOperationResult = z.infer<typeof BulkOperationResultSchema>;

export type BulkObjectDeleteResult = z.infer<typeof BulkObjectDeleteResultSchema>;

export type BulkObjectUpdateResult = z.infer<typeof BulkObjectUpdateResultSchema>;

export type BulkObjectCreateResult = z.infer<typeof BulkObjectCreateResultSchema>;

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

export type BulkOperationResponse = z.infer<typeof BulkOperationResponseSchema>;
