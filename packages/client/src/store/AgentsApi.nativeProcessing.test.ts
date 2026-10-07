import { createConversationDocument } from '@llumiverse/conversation';
import type { ExperimentalAgentProcessingClaim, ExperimentalClaimAgentProcessingPayload } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

describe('native processing exact-version SDK', () => {
    it('carries the published scheduled claim on its exact-version operation', async () => {
        const requests: Request[] = [];
        const source = createConversationDocument({
            id: 'conversation:processing',
            created_at: '2026-10-03T00:00:00Z',
        });
        const evidence = {
            version: 1,
            kind: 'native_processing_activity',
            subject_agent_run_id: 'subject/one',
            owner_agent_run_id: 'owner/one',
            scope: 'workstream:child',
            source: { conversation_id: source.id, revision: source.revision },
            job_id: 'job:one',
            workflow_run_id: 'actual-run',
            activity_id: 'activity:one',
            task_token: 'actual-opaque-token',
        } satisfies ExperimentalClaimAgentProcessingPayload;
        const claim = {
            api_version: '=20260930',
            subject_agent_run_id: evidence.subject_agent_run_id,
            owner_agent_run_id: evidence.owner_agent_run_id,
            scope: evidence.scope,
            source: evidence.source,
            job_id: evidence.job_id,
            job_fingerprint: `sha256:${'a'.repeat(64)}`,
            workflow_id: 'actual-workflow',
            workflow_run_id: evidence.workflow_run_id,
            activity_id: evidence.activity_id,
            attempt: 1,
            processing_attempt_id: `native:${'b'.repeat(64)}`,
            disposition: 'stale_optional',
        } satisfies ExperimentalAgentProcessingClaim;
        const client = new ZenoClient({
            serverUrl: 'https://store.test',
            apikey: 'existing-owner-token',
            fetch: (async (input: Request | string, init?: RequestInit) => {
                const request = input instanceof Request ? input : new Request(input, init);
                requests.push(request);
                return Response.json(request.method === 'POST' ? claim : evidence.source);
            }) as typeof fetch,
        });
        const controller = new AbortController();
        await expect(
            client.agents.claimCanonicalProcessingJob('owner/one', evidence, { signal: controller.signal }),
        ).resolves.toEqual(claim);
        expect(requests).toHaveLength(1);
        const sent = requests[0];
        expect(new URL(sent.url).pathname).toBe('/api/v1/agents/owner%2Fone/conversation/processing/claim');
        expect(sent.method).toBe('POST');
        expect(sent.headers.get('x-api-version')).toBe('=20260930');
        expect(sent.headers.get('authorization')).toBe('Bearer existing-owner-token');
        await expect(sent.json()).resolves.toEqual(evidence);
        controller.abort();
        expect(requests.every((request) => request.signal.aborted)).toBe(true);
    });
});
