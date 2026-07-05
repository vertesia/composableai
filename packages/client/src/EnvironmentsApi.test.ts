import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('EnvironmentsApi', () => {
    it('encodes model IDs in disableModel paths', async () => {
        const requests: Request[] = [];
        const fetchMock = vi.fn(async () => {
            return new Response(
                JSON.stringify({
                    id: 'env-id',
                    name: 'Test Environment',
                    provider: 'test',
                    account: 'account-id',
                    created_by: 'user:test',
                    updated_by: 'user:test',
                    created_at: new Date(0).toISOString(),
                    updated_at: new Date(0).toISOString(),
                }),
                {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                },
            );
        });

        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
            fetch: fetchMock,
            onRequest: (request) => requests.push(request),
        });

        await client.environments.disableModel('env-id', 'provider/model#v?1');

        expect(requests[0]?.url).toBe(
            'https://api.example.com/api/v1/environments/env-id/models/enabled/provider%2Fmodel%23v%3F1',
        );
    });
});
