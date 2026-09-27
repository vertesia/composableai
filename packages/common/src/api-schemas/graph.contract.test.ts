import { describe, expect, it } from 'vitest';
import {
    EndpointRefSchema,
    FindSubjectsPayloadSchema,
    FindSubjectsResponseSchema,
    RelationshipContributionEndpointSchema,
    RelationshipContributionStateQuerySchema,
    SubmitRelationshipContributionPayloadSchema,
    SubmitRelationshipContributionResponseSchema,
    TraverseRelationshipsPayloadSchema,
} from './graph.js';
import { ApiSchemaComponents } from './registry.js';

describe('graph API contracts', () => {
    it('requires a valid endpoint discriminator and keeps traversal direction optional', () => {
        expect(EndpointRefSchema.safeParse({ kind: 'external', namespace: 'crm', value: '42' }).success).toBe(true);
        expect(EndpointRefSchema.safeParse({ kind: 'external', id: '42' }).success).toBe(false);
        expect(
            TraverseRelationshipsPayloadSchema.safeParse({
                start: [{ kind: 'subject', id: 'subject-1' }],
                steps: [{}],
            }).success,
        ).toBe(true);
    });

    it('publishes the graph roots and content type nature', () => {
        const components = ApiSchemaComponents;
        expect(components.Subject).toBeDefined();
        expect(components.Relationship).toBeDefined();
        expect(components.TraverseRelationshipsPayload).toBeDefined();
        expect(components.ContentObjectTypeNature).toBeDefined();
        expect(components.ContentObjectDomain).toBeDefined();
        expect(components.SubmitRelationshipContributionPayload).toBeDefined();
        expect(components.SubmitRelationshipContributionResponse).toBeDefined();
        expect(components.RelationshipContributionStateQuery).toBeDefined();
        expect(components.FindSubjectsPayload).toBeDefined();
        expect(components.FindSubjectsResponse).toBeDefined();
    });

    it('bounds native subject discovery and returns typed canonical subjects', () => {
        expect(FindSubjectsPayloadSchema.safeParse({ query: 'Acme', type: 'company', limit: 100 }).success).toBe(true);
        expect(FindSubjectsPayloadSchema.safeParse({ query: '', limit: 1 }).success).toBe(false);
        expect(FindSubjectsPayloadSchema.safeParse({ query: 'Acme', limit: 101 }).success).toBe(false);
        expect(FindSubjectsResponseSchema.safeParse({ subjects: [], truncated: false }).success).toBe(true);
    });

    it('requires version-pinned evidence, a generation CAS, and bounded local references', () => {
        const payload = {
            generation_key: 'generation-1',
            expected_revision: 0,
            source: { document_id: 'root-1', document_version_id: 'version-1', text_etag: 'etag-1' },
            scope: 'intake-memory',
            catalog_fingerprint: 'catalog-1',
            config_fingerprint: 'config-1',
            extraction_run_id: 'run-1',
            complete: true,
            entities: [
                {
                    key: 'company',
                    type: 'company-type',
                    name: 'Acme',
                    identifiers: [],
                    evidence: [{ excerpt: 'Acme acquired Beta' }],
                },
            ],
            relationships: [
                {
                    key: 'acquisition',
                    type: 'acquired-type',
                    source: { kind: 'entity', key: 'company' },
                    target: { kind: 'document_version', id: 'version-1' },
                    properties: {},
                    evidence: [{ excerpt: 'Acme acquired Beta' }],
                },
            ],
        };
        expect(SubmitRelationshipContributionPayloadSchema.safeParse(payload).success).toBe(true);
        expect(RelationshipContributionEndpointSchema.safeParse({ kind: 'entity', key: 'company' }).success).toBe(true);
        expect(RelationshipContributionEndpointSchema.safeParse({ kind: 'entity', id: 'company' }).success).toBe(false);
        expect(RelationshipContributionEndpointSchema.safeParse({ kind: 'subject', key: 'company' }).success).toBe(
            false,
        );
        expect(
            SubmitRelationshipContributionPayloadSchema.safeParse({ ...payload, expected_revision: -1 }).success,
        ).toBe(false);
        expect(
            SubmitRelationshipContributionPayloadSchema.safeParse({
                ...payload,
                relationships: [{ ...payload.relationships[0], evidence: [] }],
            }).success,
        ).toBe(false);
        expect(
            SubmitRelationshipContributionPayloadSchema.safeParse({
                ...payload,
                relationships: [{ ...payload.relationships[0], source: { kind: 'entity', id: 'company' } }],
            }).success,
        ).toBe(false);
        expect(
            RelationshipContributionStateQuerySchema.safeParse({ document_id: 'root-1', scope: 'intake-memory' })
                .success,
        ).toBe(true);
        expect(
            SubmitRelationshipContributionResponseSchema.safeParse({
                generation_key: 'generation-1',
                revision: 1,
                status: 'published',
                counts: {
                    proposed_entities: 1,
                    resolved_entities: 0,
                    created_entities: 1,
                    unresolved_entities: 0,
                    proposed_relationships: 1,
                    published_relationships: 1,
                    unresolved_relationships: 0,
                },
                entities: [{ key: 'company', subject_id: 'subject-1', status: 'created' }],
                relationships: [{ key: 'acquisition', relationship_id: 'edge-1', status: 'published' }],
            }).success,
        ).toBe(true);
    });
});
