import {
    type AppendRunConversationToolResultsPayload,
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
    type ToolResultsPayload,
    type UserMessagePayload,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('RunsApi resume request options', () => {
    it('sends private headers on tool-result and user-message resumes', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json({ result: [], prompt: [] })),
            onRequest: (request) => requests.push(request),
        });
        const options = { headers: { 'x-vertesia-required-tool-name': 'write_artifact' } };

        await client.runs.sendToolResults({} as ToolResultsPayload, options);
        await client.runs.sendUserMessage({} as UserMessagePayload, options);

        expect(requests.map((request) => request.headers.get('x-vertesia-required-tool-name'))).toEqual([
            'write_artifact',
            'write_artifact',
        ]);
    });
});

describe('RunsApi canonical retrieval', () => {
    it('uses the dedicated endpoint and preserves the unavailable result', async () => {
        const requests: Request[] = [];
        const response = { status: 'unavailable', reason: 'retention_policy', retention: 'STANDARD' };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(response)),
            onRequest: (request) => requests.push(request),
        });
        expect(await client.runs.retrieveConversation('run-1')).toEqual(response);
        const request = requests[0];
        if (!request) throw new Error('Expected a conversation retrieval request');
        expect(new URL(request.url).pathname).toBe('/api/v1/runs/run-1/conversation');
        expect(request.method).toBe('GET');
    });

    it('posts canonical tool-result records to the run-scoped append endpoint', async () => {
        const requests: Request[] = [];
        const response = {
            conversation: { conversation_id: 'conversation-1', revision: 2 },
            operation_receipt: {
                id: 'append-1',
                conversation_id: 'conversation-1',
                payload_fingerprint: `sha256:${'0'.repeat(64)}`,
                base_revision: 1,
                result_revision: 2,
                recorded_at: '2026-09-30T00:00:00.000Z',
            },
            applied: true,
        };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(response)),
            onRequest: (request) => requests.push(request),
        });
        const payload = { operation_id: 'append-1' } as AppendRunConversationToolResultsPayload;

        expect(
            await client.runs.appendConversationToolResults('run/1', payload, {
                headers: { 'X-Api-Version': '=1', 'x-trace': 'append' },
            }),
        ).toEqual(response);
        const request = requests[0];
        if (!request) throw new Error('Expected a canonical append request');
        expect(new URL(request.url).pathname).toBe('/api/v1/runs/run%2F1/conversation/tool-results');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
        expect(request.headers.get('x-trace')).toBe('append');
        await expect(request.json()).resolves.toEqual(payload);
    });
});
