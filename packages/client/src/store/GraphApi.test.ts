import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

describe('graph store APIs', () => {
    it('targets the subject and relationship resources with encoded identifiers', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.example.test',
            fetch: vi.fn(async () => Response.json({})),
            onRequest: (request) => requests.push(request),
        });

        await client.subjects.retrieve('subject/1', { include: 'relationships', relationship_limit: 10 });
        await client.subjects.resolve({ identifiers: [{ namespace: 'crm', value: '42' }] });
        await client.subjects.find({ query: 'Acme', type: 'company', limit: 5 });
        await client.relationships.remove('edge/1', { expected_revision: 3 });
        await client.relationships.traverse({
            start: [{ kind: 'subject', id: 'subject-1' }],
            steps: [{ relationship_types: ['employed_by'] }],
        });
        await client.relationships.find({
            endpoints: [{ kind: 'subject', id: 'subject-1' }],
            direction: 'both',
            limit: 50,
            include_nodes: true,
        });
        await client.relationships.getContributionState({ document_id: 'document/1', scope: 'intake-memory' });
        await client.relationships.submitContribution({
            generation_key: 'generation-1',
            expected_revision: 0,
            source: { document_id: 'document/1', document_version_id: 'version/1', text_etag: 'etag-1' },
            scope: 'intake-memory',
            catalog_fingerprint: 'catalog-1',
            config_fingerprint: 'config-1',
            extraction_run_id: 'run-1',
            complete: true,
            entities: [],
            relationships: [],
        });
        await client.objects.upsertDomain('document/1', 'schema/1', {
            domain: {
                type: { ref_type: 'stored', id: 'schema/1', name: 'Risk' },
                version: '2',
                properties: { level: 'high' },
            },
        });

        expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
            'GET https://store.example.test/api/v1/subjects/subject%2F1?include=relationships&relationship_limit=10',
            'POST https://store.example.test/api/v1/subjects/resolve',
            'POST https://store.example.test/api/v1/subjects/find',
            'DELETE https://store.example.test/api/v1/relationships/edge%2F1?expected_revision=3',
            'POST https://store.example.test/api/v1/relationships/traverse',
            'POST https://store.example.test/api/v1/relationships/find',
            'GET https://store.example.test/api/v1/relationships/contributions/state?document_id=document%2F1&scope=intake-memory',
            'POST https://store.example.test/api/v1/relationships/contributions',
            'PUT https://store.example.test/api/v1/objects/document%2F1/domains/schema%2F1',
        ]);
        expect(await requests[2].json()).toEqual({ query: 'Acme', type: 'company', limit: 5 });
        expect(await requests[7].json()).toMatchObject({
            generation_key: 'generation-1',
            expected_revision: 0,
            complete: true,
            source: { document_version_id: 'version/1' },
        });
    });
});
