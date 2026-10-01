import type { ExperimentalAgentConversationTranscriptPage } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { VertesiaClient } from '../client.js';

const page: ExperimentalAgentConversationTranscriptPage = {
    api_version: '=20260930',
    agent_run_id: 'child/run',
    scope: 'workstream:launch-1',
    workstream_id: 'node-1',
    snapshot: { conversation_id: 'conversation:one', revision: 4 },
    fragment: {
        format: 'llumiverse.conversation-transcript',
        schema_version: 0,
        experimental_revision: '2026-09-30.adoption.1',
        source: { conversation_id: 'conversation:one', revision: 4 },
        turns: [],
        generations: {},
        assets: {},
        completeness: {
            gap_before: true,
            gap_after: false,
            semantic_content: 'partial',
            metadata: 'omitted',
            provenance: 'omitted',
            native_replay: 'omitted',
            omitted_turns: [],
            omitted_generations: [],
            omitted_blocks: [],
            omitted_assets: [],
        },
    },
};

describe('AgentsApi canonical transcript', () => {
    it('sends the exact snapshot cursor, immutable scope, and experimental version header', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.test',
            storeUrl: 'https://store.test',
            fetch: (async (input: Request | string) => {
                const request = input instanceof Request ? input : new Request(input);
                requests.push(request);
                return Response.json(page);
            }) as typeof fetch,
        });

        await expect(
            client.agents.getConversationTranscript(
                'child/run',
                {
                    conversation_scope: 'workstream:launch-1',
                    workstream_id: 'node-1',
                    snapshot_conversation_id: 'conversation:one',
                    snapshot_revision: 4,
                    after_turn_id: 'turn:one',
                    limit: 25,
                },
                { headers: { 'x-request-id': 'request-1' } },
            ),
        ).resolves.toEqual(page);

        expect(requests).toHaveLength(1);
        const url = new URL(requests[0].url);
        expect(url.pathname).toBe('/api/v1/agents/child%2Frun/conversation/transcript');
        expect(Object.fromEntries(url.searchParams)).toEqual({
            conversation_scope: 'workstream:launch-1',
            workstream_id: 'node-1',
            snapshot_conversation_id: 'conversation:one',
            snapshot_revision: '4',
            after_turn_id: 'turn:one',
            limit: '25',
        });
        expect(requests[0].headers.get('x-api-version')).toBe('=20260930');
        expect(requests[0].headers.get('x-request-id')).toBe('request-1');
    });

    it('forwards a tail window and exact revision-zero snapshot without inventing a cursor', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.test',
            storeUrl: 'https://store.test',
            fetch: (async (input: Request | string) => {
                const request = input instanceof Request ? input : new Request(input);
                requests.push(request);
                return Response.json(page);
            }) as typeof fetch,
        });

        await client.agents.getConversationTranscript('child/run', {
            conversation_scope: 'workstream:launch-1',
            workstream_id: 'node-1',
            window: 'tail',
            snapshot_conversation_id: 'conversation:one',
            snapshot_revision: 0,
            limit: 50,
        });
        expect(Object.fromEntries(new URL(requests[0].url).searchParams)).toEqual({
            conversation_scope: 'workstream:launch-1',
            workstream_id: 'node-1',
            window: 'tail',
            snapshot_conversation_id: 'conversation:one',
            snapshot_revision: '0',
            limit: '50',
        });
        expect(requests[0].headers.get('x-api-version')).toBe('=20260930');
    });

    it('omits snapshot and cursor fields on an initial root transcript request', async () => {
        const urls: URL[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.test',
            storeUrl: 'https://store.test',
            fetch: (async (input: Request | string) => {
                urls.push(new URL(typeof input === 'string' ? input : input.url));
                return Response.json({ ...page, scope: 'root', workstream_id: undefined });
            }) as typeof fetch,
        });

        await client.agents.getConversationTranscript('agent');
        expect(urls[0].search).toBe('');
    });
});
