import type { ToolResultsPayload, UserMessagePayload } from '@vertesia/common';
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
