import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('AccountApi', () => {
    it('exposes account-local custom role CRUD and the permission catalog', async () => {
        const requests: { url: string; method: string; body: unknown }[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
            fetch: async (input, init) => {
                const request = new Request(input, init);
                requests.push({
                    url: request.url,
                    method: request.method,
                    body: request.body ? await request.json() : undefined,
                });
                return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
            },
        });
        const definition = { name: 'reviewer', title: 'Reviewer', permissions: [] };
        await client.account.roles.list();
        await client.account.roles.permissions();
        await client.account.roles.create(definition);
        await client.account.roles.update('reviewer', { title: 'Document Reviewer' });
        await client.account.roles.delete('reviewer');
        expect(requests).toEqual([
            { url: 'https://api.example.com/api/v1/account/roles', method: 'GET', body: undefined },
            { url: 'https://api.example.com/api/v1/account/roles/permissions', method: 'GET', body: undefined },
            { url: 'https://api.example.com/api/v1/account/roles', method: 'POST', body: definition },
            {
                url: 'https://api.example.com/api/v1/account/roles/reviewer',
                method: 'PUT',
                body: { title: 'Document Reviewer' },
            },
            { url: 'https://api.example.com/api/v1/account/roles/reviewer', method: 'DELETE', body: undefined },
        ]);
    });
    it('returns onboarding.completed_at as the ISO string received over JSON', async () => {
        const completedAt = '2026-07-29T10:00:00.000Z';
        const fetchMock = vi.fn(async () => {
            return new Response(
                JSON.stringify({
                    id: 'account-id',
                    onboarding: { completed: true, completed_at: completedAt },
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
        });

        const account = await client.account.info();

        expect(account.onboarding.completed_at).toBe(completedAt);
        expect(account.onboarding.completed_at).not.toBeInstanceOf(Date);
    });
});
