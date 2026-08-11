import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('AccountApi', () => {
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
