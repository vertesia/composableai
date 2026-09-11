import { describe, expect, it } from 'vitest';
import { EndpointRefSchema, TraverseRelationshipsPayloadSchema } from './graph.js';
import { buildApiSchemaComponents } from './registry.js';

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
        const components = buildApiSchemaComponents();
        expect(components.Subject).toBeDefined();
        expect(components.Relationship).toBeDefined();
        expect(components.TraverseRelationshipsPayload).toBeDefined();
        expect(components.ContentObjectTypeNature).toBeDefined();
        expect(components.ContentObjectDomain).toBeDefined();
    });
});
