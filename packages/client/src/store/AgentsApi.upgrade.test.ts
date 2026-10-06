import type { ExperimentalAgentConversationUpgradePayload } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

// Transport contract only; genuine historical authority is covered by the Mongo/HTTP host suite.
describe('AgentsApi bounded historical upgrade transport', () => {
    it('preserves original operation/source, scope, version and separate finite commands', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'owner-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(new Request(input, init));
                return Response.json({
                    api_version: '=20260930',
                    agent_run_id: 'child/run',
                    scope: 'workstream:launch-1',
                    operation_id: 'upgrade:one',
                    status: 'pending',
                    step: 1,
                    source: { conversation_id: 'conversation:one', revision: 2 },
                    head: { conversation_id: 'conversation:one', revision: 2 },
                });
            }) as typeof fetch,
        });
        const commands: ExperimentalAgentConversationUpgradePayload[] = [
            {
                action: 'begin',
                operation_id: 'upgrade:one',
                expected_head: { conversation_id: 'conversation:one', revision: 2 },
            },
            { action: 'advance', operation_id: 'upgrade:one' },
            { action: 'finish', operation_id: 'upgrade:one' },
        ];
        for (const command of commands)
            await client.agents.upgradeConversation('child/run', command, 'workstream:launch-1');
        expect(requests).toHaveLength(3);
        for (const [index, request] of requests.entries()) {
            const url = new URL(request.url);
            expect(request.method).toBe('POST');
            expect(url.pathname).toBe('/api/v1/agents/child%2Frun/conversation/upgrade');
            expect(url.searchParams.get('conversation_scope')).toBe('workstream:launch-1');
            expect(request.headers.get('x-api-version')).toBe('=20260930');
            expect(await request.json()).toEqual(commands[index]);
        }
    });
});
