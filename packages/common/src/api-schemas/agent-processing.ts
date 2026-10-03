import { ConversationRefSchema, IdentifierSchema } from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE } from '../versions.js';
import { CanonicalConversationHeadScopeSchema } from './interaction.js';

/** Assertion from a scheduled worker. Only service-side Temporal history/current-chain checks grant authority. */
export const ExperimentalAgentProcessingActivityEvidenceSchema = z
    .strictObject({
        version: z.literal(1),
        kind: z.literal('native_processing_activity'),
        subject_agent_run_id: IdentifierSchema.max(1024),
        owner_agent_run_id: IdentifierSchema.max(1024),
        scope: CanonicalConversationHeadScopeSchema,
        source: ConversationRefSchema,
        job_id: IdentifierSchema.max(1024),
        workflow_run_id: IdentifierSchema.max(1024),
        activity_id: IdentifierSchema.max(1024),
        task_token: z
            .string()
            .min(1)
            .max(16 * 1024)
            .regex(/^[A-Za-z0-9_-]+$/),
    })
    .meta({ id: 'ExperimentalAgentProcessingActivityEvidence' });

/** Pre-upload read verifies one exact durable job and the actual pending worker activity. */
export const ExperimentalClaimAgentProcessingPayloadSchema = z
    .strictObject({ ...ExperimentalAgentProcessingActivityEvidenceSchema.shape })
    .meta({ id: 'ExperimentalClaimAgentProcessingPayload' });

/** An observation, never a bearer capability; every later CAS rechecks actual current execution. */
export const ExperimentalAgentProcessingClaimSchema = z
    .strictObject({
        api_version: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
        subject_agent_run_id: IdentifierSchema.max(1024),
        owner_agent_run_id: IdentifierSchema.max(1024),
        scope: CanonicalConversationHeadScopeSchema,
        source: ConversationRefSchema,
        job_id: IdentifierSchema.max(1024),
        job_fingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
        workflow_id: IdentifierSchema.max(1024),
        workflow_run_id: IdentifierSchema.max(1024),
        activity_id: IdentifierSchema.max(1024),
        attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        /** Service-derived IdentifierSchema-safe hash of the verified actual scheduled task token. */
        processing_attempt_id: IdentifierSchema.max(1024),
        /** Verified head observation only; publish rechecks the job and current scheduled task. */
        disposition: z.enum(['runnable', 'stale_optional', 'blocked', 'already_superseded']),
    })
    .meta({ id: 'ExperimentalAgentProcessingClaim' });
