import type * as Wire from './wire-types.generated.js';

/**
 * A canonical stream operation is durably reserved, but its dispatch outcome is not yet observable.
 * Clients may retry only the same operation and request when this code is returned.
 */
export const CANONICAL_STREAM_RECOVERY_PENDING_ERROR_CODE = 'canonical_stream_recovery_pending';

export type ExperimentalCanonicalAgentAcceptanceTarget = Wire.ExperimentalCanonicalAgentAcceptanceTarget;
export type ExperimentalCanonicalInitialAgentStreamRequest = Wire.ExperimentalCanonicalInitialAgentStreamRequest;
export type ExperimentalCanonicalInteractionStreamRequest = Wire.ExperimentalCanonicalInteractionStreamRequest;
export type ExperimentalCanonicalInteractionStreamOpened = Wire.ExperimentalCanonicalInteractionStreamOpened;
export type ExperimentalCanonicalInteractionStreamResumed = Wire.ExperimentalCanonicalInteractionStreamResumed;
export type ExperimentalCanonicalInteractionAcceptedRecoveryOpened =
    Wire.ExperimentalCanonicalInteractionAcceptedRecoveryOpened;
export type ExperimentalCanonicalInteractionConversationEvent = Wire.ExperimentalCanonicalInteractionConversationEvent;
export type ExperimentalCanonicalInteractionStreamEnvelope = Wire.ExperimentalCanonicalInteractionStreamEnvelope;

export type ExperimentalCanonicalToolApprovalReviewStreamRequest =
    Wire.ExperimentalCanonicalToolApprovalReviewStreamRequest;
export type ExperimentalAdmitAgentGenerationToolApprovalReviewPayload =
    Wire.ExperimentalAdmitAgentGenerationToolApprovalReviewPayload;

export type ExperimentalCanonicalInitialIngestionAccepted = Wire.ExperimentalCanonicalInitialIngestionAccepted;
