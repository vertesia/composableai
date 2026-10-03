import {
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
    type ExperimentalCanonicalToolApprovalReviewStreamRequest,
    VERSION_HEADER,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

function reviewer(): ExperimentalCanonicalToolApprovalReviewStreamRequest {
    return {
        kind: 'tool_approval_review',
        operation_id: 'review:one',
        parent: { execution_run_id: 'parent:one', generation_request_id: 'actual:child:one' },
        source: {
            conversation: { conversation_id: 'conversation:one', revision: 2 },
            turn_id: 'turn:one',
            block_id: 'block:one',
            call_id: 'call:one',
            call_fingerprint: `sha256:${'a'.repeat(64)}`,
        },
        control: { operation_id: 'routing:one', revision: 0 },
        request: {
            interaction: 'sys:ToolApprovalReviewer',
            data: { approval_request_json: '{"tool_name":"create_document"}', intent_json: '{}' },
        },
        agent_acceptance: { version: 1, subject_agent_run_id: 'subject:one', activity_id: 'review:one', scope: 'root' },
        activity_delivery: { run_id: 'actual:run', activity_id: 'review:one', task_token: 'opaque-token' },
    };
}
describe('strict reviewer SDK serialization only', () => {
    it('preserves sealed source/token/prompt bytes with exact header and no session tag decoration', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            sessionTags: ['unscheduled:late'],
            onRequest: (request) => requests.push(request.clone()),
            fetch: vi.fn(async () => {
                throw new Error('test transport stop before any server authority');
            }),
        });
        const original = reviewer();
        await expect(client.runs.streamCanonical(original, { max_reconnects: 0 })).rejects.toThrow(
            'test transport stop',
        );
        expect(requests).toHaveLength(1);
        const wire = requests[0];
        if (!wire) throw new Error('Expected actual serialized request');
        expect(new URL(wire.url).pathname).toBe('/api/v1/runs/canonical-stream');
        expect(wire.headers.get(VERSION_HEADER)).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
        expect(await wire.json()).toEqual(original);
        expect(original.request).not.toHaveProperty('tags');
    });
});
