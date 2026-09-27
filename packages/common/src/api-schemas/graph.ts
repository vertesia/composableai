import { z } from 'zod';
import { StringArrayMapSchema } from './dashboard.js';

const idSchema = z.string().min(1).max(256);
const jsonObjectSchema = z.record(z.string(), z.unknown());
const timestampSchema = z.string().meta({ format: 'date-time' });
const revisionSchema = z.number().int().nonnegative().max(2_147_483_647);

export const SubjectEndpointRefSchema = z
    .strictObject({ kind: z.literal('subject'), id: idSchema })
    .meta({ id: 'SubjectEndpointRef' });
export const DocumentEndpointRefSchema = z
    .strictObject({ kind: z.literal('document'), id: idSchema })
    .meta({ id: 'DocumentEndpointRef' });
export const DocumentVersionEndpointRefSchema = z
    .strictObject({ kind: z.literal('document_version'), id: idSchema })
    .meta({ id: 'DocumentVersionEndpointRef' });
export const ExternalEndpointRefSchema = z
    .strictObject({ kind: z.literal('external'), namespace: idSchema, value: idSchema })
    .meta({ id: 'ExternalEndpointRef' });
export const EndpointRefSchema = z
    .discriminatedUnion('kind', [
        SubjectEndpointRefSchema,
        DocumentEndpointRefSchema,
        DocumentVersionEndpointRefSchema,
        ExternalEndpointRefSchema,
    ])
    .meta({ id: 'EndpointRef' });

export const SubjectIdentifierSchema = z
    .strictObject({ namespace: idSchema, value: idSchema })
    .meta({ id: 'SubjectIdentifier' });
export const SubjectIdentifierArraySchema = z
    .array(SubjectIdentifierSchema)
    .max(100)
    .meta({ id: 'SubjectIdentifierArray' });

const auditFields = {
    created_at: timestampSchema,
    updated_at: timestampSchema,
    created_by: z.string(),
    updated_by: z.string(),
    deleted_at: timestampSchema.optional(),
    deleted_by: z.string().optional(),
};

export const SubjectSchema = z
    .strictObject({
        id: z.string(),
        type: z.string(),
        name: z.string(),
        identifiers: SubjectIdentifierArraySchema,
        properties: jsonObjectSchema,
        security: StringArrayMapSchema,
        revision: revisionSchema,
        ...auditFields,
    })
    .meta({ id: 'Subject' });
export const CreateSubjectPayloadSchema = z
    .strictObject({
        type: z.string(),
        name: z.string(),
        identifiers: SubjectIdentifierArraySchema.optional(),
        properties: jsonObjectSchema.optional(),
        security: StringArrayMapSchema.optional(),
    })
    .meta({ id: 'CreateSubjectPayload' });
export const SubjectReadQuerySchema = z
    .strictObject({
        include: z.enum(['relationships']).optional(),
        relationship_limit: z.number().int().positive().max(100).optional(),
    })
    .meta({ id: 'SubjectReadQuery' });
export const UpdateSubjectPayloadSchema = CreateSubjectPayloadSchema.partial()
    .extend({ expected_revision: revisionSchema })
    .meta({ id: 'UpdateSubjectPayload' });
export const DeleteSubjectQuerySchema = z
    .strictObject({ expected_revision: revisionSchema })
    .meta({ id: 'DeleteSubjectQuery' });
export const ResolveSubjectsPayloadSchema = z
    .strictObject({ identifiers: SubjectIdentifierArraySchema, type: z.string().optional() })
    .meta({ id: 'ResolveSubjectsPayload' });
export const SubjectResolutionSchema = z
    .strictObject({
        identifier: SubjectIdentifierSchema,
        subject_ids: z.array(idSchema),
        ambiguous: z.boolean(),
    })
    .meta({ id: 'SubjectResolution' });
export const ResolveSubjectsResponseSchema = z
    .strictObject({ resolutions: z.array(SubjectResolutionSchema), subjects: z.array(SubjectSchema) })
    .meta({ id: 'ResolveSubjectsResponse' });
export const FindSubjectsPayloadSchema = z
    .strictObject({
        query: z.string().min(1).max(200),
        type: idSchema.optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
    })
    .meta({ id: 'FindSubjectsPayload' });
export const FindSubjectsResponseSchema = z
    .strictObject({ subjects: z.array(SubjectSchema), cursor: z.string().optional(), truncated: z.boolean() })
    .meta({ id: 'FindSubjectsResponse' });
export const UpsertSubjectItemSchema = z
    .strictObject({
        idempotency_key: idSchema,
        id: idSchema.optional(),
        subject: CreateSubjectPayloadSchema,
        expected_revision: revisionSchema.optional(),
    })
    .meta({ id: 'UpsertSubjectItem' });
export const UpsertSubjectsPayloadSchema = z
    .strictObject({ items: z.array(UpsertSubjectItemSchema).min(1).max(100) })
    .meta({ id: 'UpsertSubjectsPayload' });
export const SubjectMutationResultSchema = z
    .strictObject({ idempotency_key: idSchema, subject: SubjectSchema.optional(), error: z.string().optional() })
    .meta({ id: 'SubjectMutationResult' });
export const UpsertSubjectsResponseSchema = z
    .strictObject({ results: z.array(SubjectMutationResultSchema) })
    .meta({ id: 'UpsertSubjectsResponse' });

export const RelationshipEvidenceSchema = z
    .strictObject({
        document: DocumentEndpointRefSchema.optional(),
        document_version: DocumentVersionEndpointRefSchema,
        excerpt: z.string().max(4000).optional(),
        metadata: jsonObjectSchema.optional(),
        extraction_run_id: idSchema.optional(),
    })
    .meta({ id: 'RelationshipEvidence' });
export const RelationshipSchema = z
    .strictObject({
        id: z.string(),
        type: z.string(),
        source: EndpointRefSchema,
        target: EndpointRefSchema,
        properties: jsonObjectSchema,
        evidence: z.array(RelationshipEvidenceSchema).max(100),
        confidence: z.number().min(0).max(1).optional(),
        origin: z.enum(['manual', 'extraction']),
        extraction_run_id: idSchema.optional(),
        revision: revisionSchema,
        ...auditFields,
    })
    .meta({ id: 'Relationship' });
export const CreateRelationshipPayloadSchema = z
    .strictObject({
        type: z.string(),
        source: EndpointRefSchema,
        target: EndpointRefSchema,
        properties: jsonObjectSchema.optional(),
        evidence: z.array(RelationshipEvidenceSchema).max(100).optional(),
        confidence: z.number().min(0).max(1).optional(),
        origin: z.enum(['manual', 'extraction']).optional().meta({ description: 'Defaults to manual.' }),
        extraction_run_id: idSchema.optional(),
    })
    .meta({ id: 'CreateRelationshipPayload' });
export const UpdateRelationshipPayloadSchema = CreateRelationshipPayloadSchema.partial()
    .extend({ expected_revision: revisionSchema })
    .meta({ id: 'UpdateRelationshipPayload' });
export const DeleteRelationshipQuerySchema = z
    .strictObject({ expected_revision: revisionSchema })
    .meta({ id: 'DeleteRelationshipQuery' });
export const UpsertRelationshipItemSchema = z
    .strictObject({
        idempotency_key: idSchema,
        id: idSchema.optional(),
        relationship: CreateRelationshipPayloadSchema,
        expected_revision: revisionSchema.optional(),
    })
    .meta({ id: 'UpsertRelationshipItem' });
export const UpsertRelationshipsPayloadSchema = z
    .strictObject({ items: z.array(UpsertRelationshipItemSchema).min(1).max(100) })
    .meta({ id: 'UpsertRelationshipsPayload' });
export const RelationshipMutationResultSchema = z
    .strictObject({
        idempotency_key: idSchema,
        relationship: RelationshipSchema.optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'RelationshipMutationResult' });
export const UpsertRelationshipsResponseSchema = z
    .strictObject({ results: z.array(RelationshipMutationResultSchema) })
    .meta({ id: 'UpsertRelationshipsResponse' });

/** One source version's bounded, retryable input to canonical graph reconciliation. */
export const RelationshipContributionSourceSchema = z
    .strictObject({
        document_id: idSchema,
        document_version_id: idSchema,
        text_etag: idSchema,
    })
    .meta({ id: 'RelationshipContributionSource' });
export const RelationshipContributionEvidenceSchema = z
    .strictObject({ excerpt: z.string().min(1).max(4000) })
    .meta({ id: 'RelationshipContributionEvidence' });
export const RelationshipContributionEntitySchema = z
    .strictObject({
        key: idSchema,
        type: idSchema,
        name: z.string().min(1).max(500),
        identifiers: z.array(SubjectIdentifierSchema).max(10),
        evidence: z.array(RelationshipContributionEvidenceSchema).min(1).max(4),
    })
    .meta({ id: 'RelationshipContributionEntity' });
export const RelationshipContributionEntityEndpointSchema = z
    .strictObject({ kind: z.literal('entity'), key: idSchema })
    .meta({ id: 'RelationshipContributionEntityEndpoint' });
export const RelationshipContributionEndpointSchema = z
    .discriminatedUnion('kind', [
        RelationshipContributionEntityEndpointSchema,
        SubjectEndpointRefSchema,
        DocumentEndpointRefSchema,
        DocumentVersionEndpointRefSchema,
        ExternalEndpointRefSchema,
    ])
    .meta({ id: 'RelationshipContributionEndpoint' });
export const RelationshipContributionRelationshipSchema = z
    .strictObject({
        key: idSchema,
        type: idSchema,
        source: RelationshipContributionEndpointSchema,
        target: RelationshipContributionEndpointSchema,
        properties: jsonObjectSchema,
        evidence: z.array(RelationshipContributionEvidenceSchema).min(1).max(4),
        confidence: z.number().min(0).max(1).optional(),
    })
    .meta({ id: 'RelationshipContributionRelationship' });
export const SubmitRelationshipContributionPayloadSchema = z
    .strictObject({
        generation_key: idSchema,
        expected_revision: revisionSchema,
        source: RelationshipContributionSourceSchema,
        scope: idSchema,
        catalog_fingerprint: idSchema,
        config_fingerprint: idSchema,
        extraction_run_id: idSchema,
        complete: z.boolean(),
        entities: z.array(RelationshipContributionEntitySchema).max(100),
        relationships: z.array(RelationshipContributionRelationshipSchema).max(100),
    })
    .meta({ id: 'SubmitRelationshipContributionPayload' });
export const RelationshipContributionStateQuerySchema = z
    .strictObject({ document_id: idSchema, scope: idSchema })
    .meta({ id: 'RelationshipContributionStateQuery' });
export const RelationshipContributionStateSchema = z
    .strictObject({ revision: revisionSchema, generation_key: idSchema.optional() })
    .meta({ id: 'RelationshipContributionState' });
export const RelationshipContributionEntityResolutionSchema = z
    .strictObject({
        key: idSchema,
        subject_id: idSchema.optional(),
        status: z.enum(['resolved', 'created', 'unresolved']),
    })
    .meta({ id: 'RelationshipContributionEntityResolution' });
export const RelationshipContributionRelationshipResolutionSchema = z
    .strictObject({
        key: idSchema,
        relationship_id: idSchema.optional(),
        status: z.enum(['published', 'unresolved']),
    })
    .meta({ id: 'RelationshipContributionRelationshipResolution' });
export const RelationshipContributionCountsSchema = z
    .strictObject({
        proposed_entities: z.number().int().nonnegative(),
        resolved_entities: z.number().int().nonnegative(),
        created_entities: z.number().int().nonnegative(),
        unresolved_entities: z.number().int().nonnegative(),
        proposed_relationships: z.number().int().nonnegative(),
        published_relationships: z.number().int().nonnegative(),
        unresolved_relationships: z.number().int().nonnegative(),
    })
    .meta({ id: 'RelationshipContributionCounts' });
export const SubmitRelationshipContributionResponseSchema = z
    .strictObject({
        generation_key: idSchema,
        revision: revisionSchema,
        status: z.enum(['staged', 'published', 'superseded']),
        counts: RelationshipContributionCountsSchema,
        entities: z.array(RelationshipContributionEntityResolutionSchema),
        relationships: z.array(RelationshipContributionRelationshipResolutionSchema),
    })
    .meta({ id: 'SubmitRelationshipContributionResponse' });

export const RelationshipDirectionSchema = z
    .enum(['both', 'incoming', 'outgoing'])
    .meta({ id: 'RelationshipDirection' });
export const GraphNodeSchema = z
    .strictObject({
        ref: EndpointRefSchema,
        resolved_ref: EndpointRefSchema.optional(),
        type: z.string().optional(),
        name: z.string().optional(),
        properties: jsonObjectSchema.optional(),
    })
    .meta({ id: 'GraphNode' });
export const FindRelationshipsPayloadSchema = z
    .strictObject({
        endpoints: z.array(EndpointRefSchema).min(1).max(100).optional(),
        direction: RelationshipDirectionSchema.optional().meta({ description: 'Defaults to both.' }),
        relationship_types: z.array(z.string()).optional(),
        limit: z.number().int().positive().max(1000).optional(),
        cursor: z.string().optional(),
        include_deleted: z.boolean().optional(),
        include_nodes: z
            .boolean()
            .optional()
            .meta({ description: 'Include the access-checked endpoint nodes for this relationship page.' }),
    })
    .meta({ id: 'FindRelationshipsPayload' });
export const FindRelationshipsResponseSchema = z
    .strictObject({
        relationships: z.array(RelationshipSchema),
        nodes: z.array(GraphNodeSchema).optional(),
        cursor: z.string().optional(),
        truncated: z.boolean(),
        truncation_reasons: z.array(z.string()).optional(),
    })
    .meta({ id: 'FindRelationshipsResponse' });

export const RelationshipTraversalStepSchema = z
    .strictObject({
        direction: RelationshipDirectionSchema.optional().meta({ description: 'Defaults to both.' }),
        relationship_types: z.array(idSchema).max(100).optional(),
        node_filter: jsonObjectSchema.optional(),
    })
    .meta({ id: 'RelationshipTraversalStep' });
export const TraverseRelationshipsPayloadSchema = z
    .strictObject({
        start: z.array(EndpointRefSchema).min(1).max(100),
        steps: z.array(RelationshipTraversalStepSchema).min(1).max(10),
        max_nodes: z.number().int().positive().max(1000).optional(),
        max_edges: z.number().int().positive().max(5000).optional(),
    })
    .meta({ id: 'TraverseRelationshipsPayload' });
export const TraverseRelationshipsResponseSchema = z
    .strictObject({
        nodes: z.array(GraphNodeSchema),
        edges: z.array(RelationshipSchema),
        truncated: z.boolean(),
        truncation_reasons: z.array(z.string()).optional(),
    })
    .meta({ id: 'TraverseRelationshipsResponse' });
export const SubjectRelationshipContextSchema = z
    .strictObject({
        nodes: z.array(GraphNodeSchema),
        edges: z.array(RelationshipSchema),
        evidence_edges: z.array(RelationshipSchema).optional().meta({
            description:
                'Relationships whose evidence cites the fetched document version. These relationships are not necessarily adjacent to that document.',
        }),
        cursor: z.string().optional(),
        truncated: z.boolean(),
        truncation_reasons: z.array(z.string()).optional(),
    })
    .meta({ id: 'SubjectRelationshipContext' });
export const SubjectReadResponseSchema = SubjectSchema.extend({
    relationship_context: SubjectRelationshipContextSchema.optional(),
}).meta({ id: 'SubjectReadResponse' });
