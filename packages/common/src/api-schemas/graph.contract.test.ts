import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
    CreateRelationshipPayload,
    EndpointRef,
    RelationshipEvidence,
    TraverseRelationshipsPayload,
} from '../graph.js';
import type {
    CreateRelationshipPayloadSchema,
    EndpointRefSchema,
    RelationshipEvidenceSchema,
    TraverseRelationshipsPayloadSchema,
} from './graph.js';
import { validateApiRequest, validateApiResponse } from './registry.js';

const document = { kind: 'document', id: 'doc-1' } as const;
const version = { kind: 'document_version', id: 'version-1' } as const;
const relationship = { type: 'related_to', source: document, target: version };

describe('relationship API contracts', () => {
    it('derives public types from the registered schemas', () => {
        expectTypeOf<EndpointRef>().toEqualTypeOf<import('zod').z.infer<typeof EndpointRefSchema>>();
        expectTypeOf<RelationshipEvidence>().toEqualTypeOf<import('zod').z.infer<typeof RelationshipEvidenceSchema>>();
        expectTypeOf<CreateRelationshipPayload>().toEqualTypeOf<
            import('zod').z.infer<typeof CreateRelationshipPayloadSchema>
        >();
        expectTypeOf<TraverseRelationshipsPayload>().toEqualTypeOf<
            import('zod').z.infer<typeof TraverseRelationshipsPayloadSchema>
        >();
    });

    it('accepts document endpoints and version-backed evidence', () => {
        expect(
            validateApiRequest('CreateRelationshipPayload', {
                ...relationship,
                idempotency_key: 'request-1',
                origin: 'extraction',
                evidence: [{ document, document_version: version, excerpt: 'Supported by the document' }],
            }).valid,
        ).toBe(true);
    });

    it('rejects unsupported endpoints and malformed evidence', () => {
        expect(
            validateApiRequest('CreateRelationshipPayload', {
                ...relationship,
                source: { kind: 'subject', id: 'subject-1' },
            }).valid,
        ).toBe(false);
        expect(
            validateApiRequest('CreateRelationshipPayload', {
                ...relationship,
                evidence: [{ document }],
            }).valid,
        ).toBe(false);
        expect(
            validateApiRequest('CreateRelationshipPayload', {
                ...relationship,
                idempotency_key: 'x'.repeat(257),
            }).valid,
        ).toBe(false);
    });

    it('requires a revision for update and delete, and bounds batch writes', () => {
        expect(validateApiRequest('UpdateRelationshipPayload', { properties: {} }).valid).toBe(false);
        expect(validateApiRequest('DeleteRelationshipQuery', { expected_revision: 2 }).valid).toBe(true);
        expect(
            validateApiRequest('UpsertRelationshipsPayload', {
                items: [{ idempotency_key: 'item-1', relationship }],
            }).valid,
        ).toBe(true);
        expect(validateApiRequest('UpsertRelationshipsPayload', { items: [] }).valid).toBe(false);
    });

    it('rejects search-only traversal fields and checks graph response nodes', () => {
        expect(
            validateApiRequest('TraverseRelationshipsPayload', {
                start: [document],
                steps: [{ node_filter: { name: 'example' } }],
            }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('TraverseRelationshipsResponse', {
                nodes: [{ ref: document, name: 'Document', properties: { hidden: true } }],
                edges: [],
                truncated: false,
            }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('TraverseRelationshipsResponse', {
                nodes: [{ ref: document, name: 'Document' }],
                edges: [],
                truncated: false,
            }).valid,
        ).toBe(true);
    });

    it('accepts map-derived relationships only on the read contract', () => {
        const now = '2026-11-07T00:00:00.000Z';
        const derived = {
            id: 'relationship-1',
            ...relationship,
            properties: {},
            evidence: [],
            origin: 'field_map',
            derivation: { map_id: 'vendor', source_type: 'Invoice', source_version: 'version-1' },
            revision: 1,
            created_at: now,
            updated_at: now,
            created_by: 'user:1',
            updated_by: 'user:1',
        };
        expect(validateApiResponse('Relationship', derived).valid).toBe(true);
        expect(validateApiRequest('CreateRelationshipPayload', { ...relationship, origin: 'field_map' }).valid).toBe(
            false,
        );
        expect(
            validateApiRequest('CreateRelationshipPayload', { ...relationship, derivation: derived.derivation }).valid,
        ).toBe(false);
    });

    it('bounds declared type identity fields and maps', () => {
        const type = {
            name: 'Invoice',
            identity_fields: ['invoice_number'],
            relation_maps: [
                {
                    id: 'vendor',
                    source_field: 'vendor_code',
                    target_type: 'Vendor',
                    target_identity: 'code',
                    relationship_type: 'References',
                },
            ],
        };
        expect(validateApiRequest('CreateContentObjectTypePayload', type).valid).toBe(true);
        expect(
            validateApiRequest('CreateContentObjectTypePayload', {
                ...type,
                identity_fields: ['vendor.code'],
            }).valid,
        ).toBe(false);
        expect(
            validateApiRequest('CreateContentObjectTypePayload', {
                ...type,
                relation_maps: Array.from({ length: 21 }, (_, index) => ({
                    ...type.relation_maps[0],
                    id: `map_${index}`,
                })),
            }).valid,
        ).toBe(false);
    });

    it('validates bounded value-hint policy and reconciliation envelopes', () => {
        expect(
            validateApiRequest('CreateContentObjectTypePayload', {
                name: 'Invoice',
                intake: { relationships: { enabled: true }, extraction: { value_hints: { fields: ['vendor'] } } },
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('CreateContentObjectTypePayload', {
                name: 'Invoice',
                intake: { extraction: { value_hints: { fields: [] } } },
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('RelationshipValueHintsPayload', {
                document_id: 'doc-1',
                config: { fields: ['vendor'], max_values_per_field: 51 },
            }).valid,
        ).toBe(false);
        expect(
            validateApiRequest('RelationshipValueHintsPayload', {
                document_id: 'doc-1',
                type_id: 'Vendor',
                config: { fields: ['vendor'] },
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('RelationshipValueHintsPayload', {
                document_id: 'doc-1',
                type_id: 'x'.repeat(257),
            }).valid,
        ).toBe(false);
        expect(validateApiRequest('ReconcileRelationshipsPayload', { document_id: 'doc-1' }).valid).toBe(true);
        expect(
            validateApiResponse('ReconcileRelationshipsResponse', {
                document,
                document_version: version,
                dry_run: true,
                results: [{ map_id: 'vendor', status: 'ambiguous', matched: 2, created: 0, updated: 0, deleted: 0 }],
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ReconcileRelationshipsResponse', {
                document,
                document_version: version,
                dry_run: true,
                results: Array.from({ length: 21 }, (_, index) => ({
                    map_id: `retired_${index}`,
                    status: 'missing',
                    matched: 0,
                    created: 0,
                    updated: 0,
                    deleted: 1,
                })),
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('RelationshipValueHintsResponse', {
                fields: [{ field: 'vendor', values: [{ value: 'Acme', count: 3 }] }],
                truncated: false,
                scanned_documents: 3,
            }).valid,
        ).toBe(true);
    });
});
