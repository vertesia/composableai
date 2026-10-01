import type {
    ImportAgentRunConversationArchivePayload,
    ImportAgentRunConversationArchiveResponse,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

const response: ImportAgentRunConversationArchiveResponse = {
    api_version: '=20260930',
    status: 'attestation_required',
    continuation_readiness: 'not_validated',
    source: {
        subject_run_id: 'child/run',
        owner_run_id: 'owner',
        scope: 'workstream:launch',
        workflow_id: 'workflow',
        first_workflow_run_id: 'first',
        content_hash: `sha256:${'a'.repeat(64)}`,
        byte_length: 42,
        storage_generation: 'etag',
        immutable_storage_version: null,
    },
};

describe('AgentsApi explicit historical import', () => {
    it.each([false, true])('propagates exact audited payload/version and scoped subject: %s', async (attested) => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                requests.push(input instanceof Request ? input : new Request(input, init));
                return Response.json(response);
            }) as typeof fetch,
        });
        const payload: ImportAgentRunConversationArchivePayload = attested
            ? {
                  type: 'attested_native',
                  expected_source: response.source,
                  attestation: {
                      evidence: 'owner_attested',
                      protocol: 'anthropic.messages',
                      provider: 'vertexai',
                      model: null,
                      completeness: 'unknown',
                      recorded_at: '2026-10-01T00:00:00.000Z',
                      evidence_note: 'Explicit owner origin declaration',
                      tool_definitions: [],
                  },
              }
            : { type: 'source' };
        await expect(
            client.agents.importConversationArchive('child/run', payload, { headers: { 'x-trace': 'import' } }),
        ).resolves.toEqual(response);
        const request = requests[0];
        expect(new URL(request.url).pathname).toBe('/api/v1/agents/child%2Frun/conversation/import');
        expect(new URL(request.url).search).toBe('');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(request.headers.get('x-trace')).toBe('import');
        expect(await request.json()).toEqual(payload);
    });
});
