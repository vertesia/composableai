import { z } from 'zod';
import { ContentTypeValueHintsPolicySchema } from './store.js';

const idSchema = z.string().min(1).max(256);
const jsonObjectSchema = z.record(z.string(), z.unknown());
const timestampSchema = z.string().meta({ format: 'date-time' });
const revisionSchema = z.number().int().nonnegative().max(2_147_483_647);

export const DocumentEndpointRefSchema = z
    .strictObject({ kind: z.literal('document'), id: idSchema })
    .meta({ id: 'DocumentEndpointRef' });
export const DocumentVersionEndpointRefSchema = z
    .strictObject({ kind: z.literal('document_version'), id: idSchema })
    .meta({ id: 'DocumentVersionEndpointRef' });
// Both endpoint kinds share a shape. A oneOf here is ambiguous in the generated Go client's decoder.
export const EndpointRefSchema = z
    .strictObject({ kind: z.enum(['document', 'document_version']), id: idSchema })
    .meta({ id: 'EndpointRef' });

const auditFields = {
    created_at: timestampSchema,
    updated_at: timestampSchema,
    created_by: z.string(),
    updated_by: z.string(),
    deleted_at: timestampSchema.optional(),
    deleted_by: z.string().optional(),
};

export const RelationshipEvidenceSchema = z
    .strictObject({
        document: DocumentEndpointRefSchema.optional(),
        document_version: DocumentVersionEndpointRefSchema,
        excerpt: z.string().max(4000).optional(),
        metadata: jsonObjectSchema.optional(),
        extraction_run_id: idSchema.optional(),
    })
    .meta({ id: 'RelationshipEvidence' });
export const RelationshipDerivationSchema = z
    .strictObject({
        map_id: idSchema.meta({ description: 'Stable ID of the source content type relation map.' }),
        source_type: idSchema.meta({ description: 'Source document content type ID.' }),
        source_version: idSchema.meta({ description: 'Source document version that produced this relationship.' }),
    })
    .meta({ id: 'RelationshipDerivation' });
export const RelationshipSchema = z
    .strictObject({
        id: z.string(),
        type: z.string(),
        source: EndpointRefSchema,
        target: EndpointRefSchema,
        properties: jsonObjectSchema,
        evidence: z.array(RelationshipEvidenceSchema).max(100),
        confidence: z.number().min(0).max(1).optional(),
        origin: z.enum(['manual', 'extraction', 'field_map']),
        extraction_run_id: idSchema.optional(),
        derivation: RelationshipDerivationSchema.optional().meta({
            description: 'Map provenance for automatically reconciled relationships; read only.',
        }),
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
        idempotency_key: idSchema
            .meta({
                description:
                    'Optional project-scoped retry key. Repeating the same create request returns the existing ' +
                    'relationship; reusing the key with a different request is rejected with 422.',
            })
            .optional(),
    })
    .meta({ id: 'CreateRelationshipPayload' });
export const UpdateRelationshipPayloadSchema = CreateRelationshipPayloadSchema.omit({ idempotency_key: true })
    .partial()
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

export const RelationshipDirectionSchema = z
    .enum(['both', 'incoming', 'outgoing'])
    .meta({ id: 'RelationshipDirection' });
export const GraphNodeSchema = z
    .strictObject({
        ref: EndpointRefSchema,
        resolved_ref: EndpointRefSchema.optional(),
        type: z.string().optional(),
        name: z.string().optional(),
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

export const RelationshipMapResultSchema = z
    .strictObject({
        map_id: idSchema,
        status: z.enum(['resolved', 'unresolved', 'ambiguous', 'missing', 'truncated']),
        error: z.string().optional(),
        matched: z.int32().nonnegative(),
        created: z.int32().nonnegative(),
        updated: z.int32().nonnegative(),
        deleted: z.int32().nonnegative(),
    })
    .meta({ id: 'RelationshipMapResult' });
export const ReconcileRelationshipsPayloadSchema = z
    .strictObject({
        document_id: idSchema.meta({ description: 'Source document root ID.' }),
        dry_run: z.boolean().optional().meta({ description: 'Preview changes without writing. Defaults to true.' }),
    })
    .meta({ id: 'ReconcileRelationshipsPayload' });
export const ReconcileRelationshipsResponseSchema = z
    .strictObject({
        document: DocumentEndpointRefSchema,
        document_version: DocumentVersionEndpointRefSchema,
        dry_run: z.boolean(),
        results: z.array(RelationshipMapResultSchema),
    })
    .meta({ id: 'ReconcileRelationshipsResponse' });
export const RelationshipValueHintsPayloadSchema = z
    .strictObject({
        document_id: idSchema.meta({ description: 'Document root ID whose content type selects hint fields.' }),
        type_id: z.string().min(1).max(256).optional().meta({
            description: 'Explicit chosen document content type for value hints before the type is assigned.',
        }),
        config: ContentTypeValueHintsPolicySchema.optional().meta({
            description:
                'Effective value-hints policy override. Omission uses the document content type configuration.',
        }),
    })
    .meta({ id: 'RelationshipValueHintsPayload' });
export const RelationshipValueHintsResponseSchema = z
    .strictObject({
        fields: z
            .array(
                z.strictObject({
                    field: z.string(),
                    values: z.array(z.strictObject({ value: z.string(), count: z.int32().positive() })).max(50),
                }),
            )
            .max(10),
        truncated: z.boolean(),
        scanned_documents: z.int32().nonnegative(),
    })
    .meta({ id: 'RelationshipValueHintsResponse' });
