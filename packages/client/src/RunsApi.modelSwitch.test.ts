import { createConversationDocument, prepareModelSwitch } from '@llumiverse/conversation';
import {
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
    ExecutionRunStatus,
    type ExperimentalCanonicalInteractionModelSwitchPrepareRequest,
    RunDataStorageLevel,
    VERSION_HEADER,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('RunsApi canonical model-switch planning', () => {
    it('sends an exact-version prospective request with the same session tags as execution', async () => {
        const document = createConversationDocument({
            id: 'conversation:model-switch-client',
            created_at: '2026-10-03T00:00:00.000Z',
        });
        const target = {
            provider: 'openai',
            protocol: 'openai.responses',
            model: 'gpt-5.4',
            adapter_version: 'v1',
        };
        const plan = await prepareModelSwitch(
            document,
            {
                source: { conversation_id: document.id, revision: document.revision },
                expected_context_revision: document.context.revision,
                target,
                measurement_policy: 'identified_estimate',
            },
            {
                project: async () => ({ status: 'unsupported', reason: 'No fixture transport' }),
                hasUnsettledGeneration: async () => false,
            },
        );
        const payload: ExperimentalCanonicalInteractionModelSwitchPrepareRequest = {
            operation: 'execute',
            measurement_policy: 'identified_estimate',
            request: {
                interaction: 'interaction:model-switch',
                initial_state: {
                    type: 'reference',
                    reference: { run_id: 'run:source', conversation: plan.source },
                    operation_id: 'operation:model-switch',
                },
                retention: RunDataStorageLevel.DEBUG,
                return_policy: { history: 'reference' },
            },
        };
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            sessionTags: ['unscheduled:late'],
            onRequest: (request) => requests.push(request.clone()),
            fetch: vi.fn(async () =>
                Response.json({
                    plan,
                    request_fingerprint: 'sha256:prospective-request',
                    operation: 'execute',
                }),
            ),
        });
        const result = await client.runs.prepareCanonicalModelSwitch(payload);
        expect(result.plan).toEqual(plan);
        expect(requests).toHaveLength(1);
        const wire = requests[0];
        if (!wire) throw new Error('Expected serialized model-switch request');
        expect(new URL(wire.url).pathname).toBe('/api/v1/runs/canonical-model-switch/prepare');
        expect(wire.headers.get(VERSION_HEADER)).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
        expect(await wire.json()).toEqual({ ...payload, request: { ...payload.request, tags: ['unscheduled:late'] } });
        expect(payload.request).not.toHaveProperty('tags');
    });

    it.each(['execute', 'stream'] as const)(
        'uses identical owned request tags for %s planning and the actual request',
        async (operation) => {
            const document = createConversationDocument({
                id: 'conversation:model-switch-session',
                created_at: '2026-10-03T00:00:00.000Z',
            });
            const target = {
                provider: 'openai',
                protocol: 'openai.responses',
                model: 'gpt-5.4',
                adapter_version: 'v1',
            };
            const plan = await prepareModelSwitch(
                document,
                {
                    source: { conversation_id: document.id, revision: document.revision },
                    expected_context_revision: document.context.revision,
                    target,
                    measurement_policy: 'identified_estimate',
                },
                {
                    project: async () => ({ status: 'unsupported', reason: 'No fixture transport' }),
                    hasUnsettledGeneration: async () => false,
                },
            );
            const request = {
                interaction: 'interaction:model-switch',
                initial_state: {
                    type: 'reference' as const,
                    reference: { run_id: 'run:source', conversation: plan.source },
                    operation_id: 'operation:model-switch',
                },
                retention: RunDataStorageLevel.DEBUG,
                return_policy: { history: 'reference' as const },
                tags: ['explicit:one'],
            };
            const original = structuredClone(request);
            const wires: Request[] = [];
            let call = 0;
            const client = new VertesiaClient({
                serverUrl: 'https://studio.example.com',
                storeUrl: 'https://zeno.example.com',
                sessionTags: ['session:one'],
                onRequest: (wire) => wires.push(wire.clone()),
                fetch: vi.fn(async () => {
                    call += 1;
                    if (call === 1)
                        return Response.json({
                            plan,
                            request_fingerprint: 'sha256:prospective-request',
                            operation,
                        });
                    if (operation === 'execute')
                        return Response.json({
                            run: {
                                id: 'run:target',
                                status: ExecutionRunStatus.completed,
                                interaction: request.interaction,
                                created_at: '2026-10-03T00:00:00.000Z',
                                updated_at: '2026-10-03T00:00:00.000Z',
                                retention: RunDataStorageLevel.DEBUG,
                            },
                            output: { status: 'unavailable', reason: 'no_accepted_response' },
                            history: {
                                status: 'unavailable',
                                reason: 'not_requested',
                                retention: RunDataStorageLevel.DEBUG,
                            },
                        });
                    const envelope = {
                        api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
                        type: 'stream_opened',
                        run_id: 'run:target',
                        operation_id: request.initial_state.operation_id,
                        stream_id: 'stream:model-switch',
                    };
                    const accepted = {
                        api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
                        type: 'conversation_event',
                        run_id: 'run:target',
                        host_status: 'accepted',
                        event: {
                            format: 'llumiverse.conversation',
                            schema_version: 0,
                            experimental_revision: '2026-09-30.adoption.1',
                            stream_id: 'stream:model-switch',
                            request_id: 'request:model-switch',
                            attempt_id: 'attempt:model-switch',
                            response_operation_id: 'response:model-switch',
                            generation_id: 'generation:model-switch',
                            draft_turn_id: 'turn:draft',
                            event_id: 'stream:model-switch#0',
                            sequence: 0,
                            type: 'response_accepted',
                            origin: 'live_transport',
                            conversation: { conversation_id: document.id, revision: 1 },
                            operation_receipt_id: 'receipt:model-switch',
                            committed_turn_id: 'turn:accepted',
                            turn_status: 'completed',
                            generation_status: 'completed',
                            committed_block_ids: [],
                            accepted_asset_ids: [],
                            reconciliations: [],
                        },
                    };
                    return new Response(`data: ${JSON.stringify(envelope)}\n\ndata: ${JSON.stringify(accepted)}\n\n`, {
                        headers: { 'content-type': 'text/event-stream' },
                    });
                }),
            });
            const prepared = await client.runs.prepareCanonicalModelSwitch({ request, operation });
            const bound = {
                ...request,
                model_switch: {
                    plan: prepared.plan,
                    request_fingerprint: prepared.request_fingerprint,
                },
            };
            if (operation === 'execute') {
                await client.runs.createCanonical(bound);
            } else {
                await client.runs.streamCanonical({
                    operation_id: request.initial_state.operation_id,
                    request: bound,
                });
            }
            expect(wires).toHaveLength(2);
            const plannedWire = await wires[0]?.json();
            const actualWire = await wires[1]?.json();
            expect(plannedWire?.request.tags).toEqual(['session:one', 'explicit:one']);
            expect(operation === 'execute' ? actualWire?.tags : actualWire?.request.tags).toEqual(
                plannedWire?.request.tags,
            );
            expect(request).toEqual(original);
            expect(bound.tags).toEqual(['explicit:one']);
        },
    );
});
