import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from '../client.js';

describe('subscription workflow catalog SDK', () => {
    it('uses the store endpoint and preserves schemas and templates', async () => {
        const catalog = {
            workflows: [
                {
                    endpoint: 'Intake',
                    title: 'Intake',
                    description: 'Process content',
                    variables_schema: { type: 'object', properties: { enabled: { type: 'boolean' } } },
                    variables_template: { enabled: true },
                },
            ],
        };
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.test',
            storeUrl: 'https://store.example.test',
            fetch: vi.fn(async () => Response.json(catalog)),
            onRequest: (request) => {
                requests.push(request);
            },
        });
        expect(await client.store.workflows.getSubscriptionWorkflowCatalog()).toEqual(catalog);
        expect(requests[0].method).toBe('GET');
        expect(requests[0].url).toBe('https://store.example.test/api/v1/workflows/subscription-catalog');
    });
});

describe('workflow jobs and usage SDK', () => {
    it('uses typed job paths, pagination and the read-only usage endpoint', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.test',
            storeUrl: 'https://store.example.test',
            fetch: vi.fn(async () => Response.json({ id: 'job' })),
            onRequest: (request) => {
                requests.push(request);
            },
        });
        const payload = {
            target: { type: 'workflow' as const, name: 'Example' },
            object_ids: ['1'.repeat(24)],
            expires_at: '2027-01-01T00:00:00Z',
            idempotency_key: 'stable',
        };
        await client.store.workflows.jobs.create(payload);
        await client.store.workflows.jobs.retrieve('job');
        await client.store.workflows.jobs.children('job', { after: 'cursor', limit: 10 });
        await client.store.workflows.jobs.revoke('job');
        await client.store.workflows.usage({ workflow_class: 'conversation' });
        expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
            ['POST', '/api/v1/workflows/jobs'],
            ['GET', '/api/v1/workflows/jobs/job'],
            ['GET', '/api/v1/workflows/jobs/job/children'],
            ['POST', '/api/v1/workflows/jobs/job/revoke'],
            ['GET', '/api/v1/workflows/usage'],
        ]);
        expect(await requests[0].json()).toEqual(payload);
        expect(new URL(requests[2].url).searchParams.get('after')).toBe('cursor');
        expect(new URL(requests[4].url).searchParams.get('workflow_class')).toBe('conversation');
    });
});
