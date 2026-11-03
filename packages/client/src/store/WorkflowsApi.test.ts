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

it('keeps async request-observation hooks detached from request dispatch', async () => {
    const rejectedLog = Promise.reject(new Error('logger unavailable'));
    void rejectedLog.catch(() => {});
    const fetch = vi.fn(async () => Response.json({ classes: [] }));
    const client = new VertesiaClient({
        serverUrl: 'https://api.example.test',
        storeUrl: 'https://store.example.test',
        fetch,
        onRequest: () => rejectedLog,
    });
    await expect(client.store.workflows.usage()).resolves.toEqual({ classes: [] });
    expect(fetch).toHaveBeenCalledTimes(1);
});
