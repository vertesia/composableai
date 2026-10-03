import { AssetSchema, TimestampSchema } from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE } from '../versions.js';

/** Original upload publication selects an authorized artifact; clients never supply identity evidence. */
export const ExperimentalPublishAgentAssetPayloadSchema = z
    .strictObject({
        operation_id: z.string().min(1).max(1024),
        artifact_path: z
            .string()
            .min(1)
            .max(2048)
            // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in artifact keys.
            .regex(/^(?!\/)(?![\s\S]*(?:^|\/)\.{1,2}(?:\/|$))(?![\s\S]*\/\/)[^\x00-\x1f\x7f]*[^/\x00-\x1f\x7f]$/),
    })
    .meta({ id: 'ExperimentalPublishAgentAssetPayload' });

/** Hash and byte length are mandatory for server-published attachment assets. */
export const ExperimentalPublishedAgentAssetSchema = AssetSchema.extend({
    content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    byte_length: z
        .number()
        .int()
        .min(0)
        .max(50 * 1024 * 1024),
}).meta({ id: 'ExperimentalPublishedAgentAsset' });

export const ExperimentalAgentAssetPublicationSchema = z
    .strictObject({
        api_version: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
        subject_agent_run_id: z.string().min(1).max(1024),
        operation_id: z.string().min(1).max(1024),
        asset: ExperimentalPublishedAgentAssetSchema,
        published_at: TimestampSchema,
    })
    .meta({ id: 'ExperimentalAgentAssetPublication' });

/** Select one retained publication; bytes, provenance and execution identity are host-derived. */
export const ExperimentalExtractAgentAssetPayloadSchema = z
    .strictObject({
        operation_id: z.string().min(1).max(1024),
        transform: z.literal('document_text/v1'),
    })
    .meta({ id: 'ExperimentalExtractAgentAssetPayload' });

export const ExperimentalAgentAssetDerivationSourceSchema = z
    .strictObject({
        publication_operation_id: ExperimentalAgentAssetPublicationSchema.shape.operation_id,
        asset_id: ExperimentalPublishedAgentAssetSchema.shape.id,
        content_hash: ExperimentalPublishedAgentAssetSchema.shape.content_hash,
    })
    .meta({ id: 'ExperimentalAgentAssetDerivationSource' });

export const ExperimentalAgentAssetDerivationTransformSchema = z
    .strictObject({
        id: z.literal('vertesia.document_text'),
        version: z.literal('1'),
        configuration_fingerprint: ExperimentalPublishedAgentAssetSchema.shape.content_hash,
    })
    .meta({ id: 'ExperimentalAgentAssetDerivationTransform' });

/** Publication is constructed only from the result of the intent's exact actual Temporal execution. */
export const ExperimentalAgentAssetDerivationSchema = z
    .strictObject({
        version: z.literal(1),
        subject_agent_run_id: ExperimentalAgentAssetPublicationSchema.shape.subject_agent_run_id,
        operation_id: ExperimentalAgentAssetPublicationSchema.shape.operation_id,
        source: ExperimentalAgentAssetDerivationSourceSchema,
        transform: ExperimentalAgentAssetDerivationTransformSchema,
        output: ExperimentalAgentAssetPublicationSchema,
    })
    .meta({ id: 'ExperimentalAgentAssetDerivation' });

const extractionIdentity = {
    api_version: ExperimentalAgentAssetPublicationSchema.shape.api_version,
    subject_agent_run_id: ExperimentalAgentAssetPublicationSchema.shape.subject_agent_run_id,
    operation_id: ExperimentalAgentAssetPublicationSchema.shape.operation_id,
    source_operation_id: ExperimentalAgentAssetPublicationSchema.shape.operation_id,
};

export const ExperimentalAgentAssetExtractionPendingSchema = z
    .strictObject({ ...extractionIdentity, status: z.literal('pending') })
    .meta({ id: 'ExperimentalAgentAssetExtractionPending' });

export const ExperimentalAgentAssetExtractionAvailableSchema = z
    .strictObject({
        ...extractionIdentity,
        status: z.literal('available'),
        derivation: ExperimentalAgentAssetDerivationSchema,
    })
    .meta({ id: 'ExperimentalAgentAssetExtractionAvailable' });

export const ExperimentalAgentAssetExtractionFailedSchema = z
    .strictObject({
        ...extractionIdentity,
        status: z.literal('failed'),
        reason: z.enum(['unsupported_format', 'extraction_failed', 'source_unavailable', 'cancelled']),
        message: z.string().max(4096),
    })
    .meta({ id: 'ExperimentalAgentAssetExtractionFailed' });

export const ExperimentalAgentAssetExtractionSchema = z
    .discriminatedUnion('status', [
        ExperimentalAgentAssetExtractionPendingSchema,
        ExperimentalAgentAssetExtractionAvailableSchema,
        ExperimentalAgentAssetExtractionFailedSchema,
    ])
    .meta({ id: 'ExperimentalAgentAssetExtraction' });

/** Caller run is an equality assertion; the host derives the execution from the sealed intent. */
export const ExperimentalClaimAgentAssetExtractionPayloadSchema = z
    .strictObject({ expected_run_id: z.string().min(1).max(1024) })
    .meta({ id: 'ExperimentalClaimAgentAssetExtractionPayload' });

/** Immutable pre-I/O authorization for exactly one host-proved first execution. */
export const ExperimentalAgentAssetExtractionClaimSchema = z
    .strictObject({
        api_version: ExperimentalAgentAssetPublicationSchema.shape.api_version,
        subject_agent_run_id: ExperimentalAgentAssetPublicationSchema.shape.subject_agent_run_id,
        operation_id: ExperimentalAgentAssetPublicationSchema.shape.operation_id,
        workflow_id: z.string().min(1).max(1024),
        run_id: ExperimentalClaimAgentAssetExtractionPayloadSchema.shape.expected_run_id,
    })
    .meta({ id: 'ExperimentalAgentAssetExtractionClaim' });
