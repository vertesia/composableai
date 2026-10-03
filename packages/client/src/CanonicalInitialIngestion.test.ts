import { createConversationDocument } from '@llumiverse/conversation';
import type {
    ExperimentalCanonicalInitialAgentStreamRequest,
    ExperimentalCanonicalInitialRenderedInputHeadPayload,
} from '@vertesia/common';
import { RunDataStorageLevel } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { VertesiaClient } from './client.js';

const request = {
    kind: 'initial_agent',
    operation_id: 'operation:actual-initial',
    request: {
        interaction: 'stored-interaction',
        initial_state: {
            type: 'document',
            document: createConversationDocument({
                id: 'conversation:initial',
                created_at: '2026-10-03T00:00:00Z',
            }),
        },
        retention: RunDataStorageLevel.DEBUG,
        return_policy: { history: 'none' },
        tags: ['scheduled:exact'],
    },
    agent_acceptance: {
        version: 1,
        subject_agent_run_id: 'subject:child',
        scope: 'child:scope',
        workstream_id: 'report',
        activity_id: 'activity:actual',
    },
    activity_delivery: { activity_id: 'activity:actual', run_id: 'run:actual', task_token: 'token:actual' },
} satisfies ExperimentalCanonicalInitialAgentStreamRequest;

describe('targetless initial ingestion SDK serialization', () => {
    it('keeps source0, rendered source1 and original sealed inputs distinct on exact-version routes', async () => {
        const calls: Request[] = [];
        const source0 = { conversation_id: request.request.initial_state.document.id, revision: 0 };
        const source1 = { ...source0, revision: 1 };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.test',
            storeUrl: 'https://zeno.test',
            sessionTags: ['late:session'],
            fetch: async (input, init) => {
                const wire = input instanceof Request ? input : new Request(input, init);
                calls.push(wire);
                if (new URL(wire.url).pathname.endsWith('canonical-initial-authoring'))
                    return Response.json({ execution_run_id: 'actual:stored-run', source: source0 });
                return Response.json(calls.length === 1 ? source0 : source1);
            },
        });
        const signal = new AbortController();
        expect(
            await client.store.agents.initializeCanonicalInitialConversationHead(
                'owner/actual',
                request,
                'child:scope',
                { signal: signal.signal },
            ),
        ).toEqual(source0);
        const authored = await client.runs.prepareCanonicalInitialAuthoring(request, { signal: signal.signal });
        expect(authored).toEqual({ execution_run_id: 'actual:stored-run', source: source0 });
        const rendered = {
            kind: 'initial_rendered_input',
            activity: { request, execution_run_id: authored.execution_run_id },
        } satisfies ExperimentalCanonicalInitialRenderedInputHeadPayload;
        expect(
            await client.store.agents.acceptCanonicalInitialRenderedInputHead('owner/actual', rendered, 'child:scope', {
                signal: signal.signal,
            }),
        ).toEqual(source1);
        expect(calls.map((wire) => new URL(wire.url).pathname)).toEqual([
            '/api/v1/agents/owner%2Factual/conversation/head',
            '/api/v1/runs/canonical-initial-authoring',
            '/api/v1/agents/owner%2Factual/conversation/head',
        ]);
        expect(calls.map((wire) => wire.method)).toEqual(['PUT', 'POST', 'PUT']);
        expect(calls.map((wire) => wire.headers.get('x-api-version'))).toEqual(['=20260930', '=20260930', '=20260930']);
        expect(await calls[0].json()).toEqual(request);
        expect(await calls[1].json()).toEqual(request);
        expect(await calls[2].json()).toEqual(rendered);
        expect(request.request.initial_state.document.revision).toBe(0);
        expect(request.request.tags).toEqual(['scheduled:exact']);
        signal.abort();
        expect(calls.every((wire) => wire.signal.aborted)).toBe(true);
    });
});
