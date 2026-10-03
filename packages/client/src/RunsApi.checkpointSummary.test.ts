import {
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
    type ExperimentalCanonicalCheckpointSummaryPayload,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('RunsApi canonical checkpoint summary', () => {
    it('uses the existing native resume transport with exact source, control and real callback fields', async () => {
        const requests: Request[] = [];
        const result = { status: 'accepted', run_id: 'interaction:1', activity_id: 'actual:activity' };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://store.example.com',
            fetch: vi.fn(async () => Response.json(result)),
            onRequest: (request) => requests.push(request),
        });
        const payload: ExperimentalCanonicalCheckpointSummaryPayload = {
            kind: 'checkpoint_summary',
            run: { id: 'interaction:1', account: 'account:1', project: 'project:1' },
            operation_id: 'summary:1',
            source: {
                subject_agent_run_id: 'agent:1',
                conversation: { conversation_id: 'conversation:1', revision: 4 },
                scope: 'root',
            },
            control: { operation_id: 'routing:1', revision: 2 },
            asyncCompletion: { run_id: 'actual:delivery', activity_id: 'actual:activity', task_token: 'opaque:token' },
        };
        expect(
            await client.runs.sendCanonicalCheckpointSummary(payload, {
                headers: { 'x-trace': 'summary', 'X-Api-Version': '=1' },
            }),
        ).toEqual(result);
        const request = requests[0];
        if (!request) throw new Error('Expected a summary request');
        expect(new URL(request.url).pathname).toBe('/api/v1/runs/user-message');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
        expect(request.headers.get('x-trace')).toBe('summary');
        await expect(request.json()).resolves.toEqual(payload);
    });
});
