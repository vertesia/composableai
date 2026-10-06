import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

// Wire transport only. Accepted authority is exercised by the genuine Mongo/HTTP host suite.
describe('AgentsApi canonical logical deletion', () => {
    it('preserves exact source, operation identity, immutable scope and negotiated version', async () => {
        const requests: Request[] = [];
        const response = {
            api_version: '=20260930',
            agent_run_id: 'child/run',
            scope: 'workstream:launch-1',
            applied: false,
            head: { conversation_id: 'conversation:one', revision: 3 },
            receipt: {
                id: 'delete:one',
                conversation_id: 'conversation:one',
                base_revision: 2,
                result_revision: 3,
                recorded_at: '2026-10-06T00:00:00.000Z',
            },
        };
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'owner-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(new Request(input, init));
                return Response.json(response);
            }) as typeof fetch,
        });
        const payload = {
            operation_id: 'delete:one',
            expected_head: { conversation_id: 'conversation:one', revision: 2 },
            dependency_policy: 'reject' as const,
            turn_ids: ['turn:one'],
        };
        expect(await client.agents.deleteConversationTurns('child/run', payload, 'workstream:launch-1')).toEqual(
            response,
        );
        const request = requests[0];
        if (!request) throw new Error('Expected actual SDK request');
        const url = new URL(request.url);
        expect(request.method).toBe('PUT');
        expect(url.pathname).toBe('/api/v1/agents/child%2Frun/conversation/delete');
        expect(url.searchParams.get('conversation_scope')).toBe('workstream:launch-1');
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(await request.json()).toEqual(payload);
        expect(requests).toHaveLength(1);
    });
});
