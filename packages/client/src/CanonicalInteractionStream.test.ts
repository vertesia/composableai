import { createConversationDocument } from '@llumiverse/conversation';
import { ConnectionError, ServerError } from '@vertesia/api-fetch-client';
import type {
    ConversationStreamEvent,
    ExperimentalCanonicalInteractionStreamEnvelope,
    ExperimentalCanonicalInteractionStreamRequest,
} from '@vertesia/common';
import {
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
    RunDataStorageLevel,
    VERSION_HEADER,
} from '@vertesia/common';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
    type CanonicalInitialInteractionStreamResult,
    type CanonicalInteractionStreamResult,
    type CanonicalInteractionStreamTransport,
    consumeCanonicalInteractionStream,
} from './CanonicalInteractionStream.js';
import { VertesiaClient } from './client.js';

const API_VERSION = EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE;
const RUN_ID = '507f1f77bcf86cd799439011';
const STREAM_ID = 'stream:sdk';

const request: Exclude<ExperimentalCanonicalInteractionStreamRequest, { kind: 'initial_agent' }> & {
    kind?: 'tool_approval_review';
} = {
    operation_id: 'operation:sdk',
    request: {
        interaction: 'stream-test',
        initial_state: { type: 'new' },
        retention: RunDataStorageLevel.DEBUG,
        return_policy: { history: 'reference' },
    },
};

function identity(streamId = STREAM_ID) {
    return {
        format: 'llumiverse.conversation' as const,
        schema_version: 0 as const,
        experimental_revision: '2026-09-30.adoption.1' as const,
        stream_id: streamId,
        request_id: 'request:sdk',
        attempt_id: 'attempt:sdk',
        response_operation_id: 'operation:response',
        generation_id: 'generation:sdk',
        draft_turn_id: 'turn:draft',
    };
}

function event<T extends Record<string, unknown>>(sequence: number, fields: T, streamId = STREAM_ID) {
    return {
        ...identity(streamId),
        event_id: `${streamId}#${sequence}`,
        sequence,
        ...fields,
    };
}

function draftStarted(streamId = STREAM_ID): ConversationStreamEvent {
    return event(0, { type: 'draft_started' as const, origin: 'live_transport' as const }, streamId);
}

function draftFinished(streamId = STREAM_ID): ConversationStreamEvent {
    return event(
        1,
        { type: 'draft_finished' as const, outcome: 'completed' as const, finish_reason: 'stop' },
        streamId,
    );
}

function accepted(
    streamId = STREAM_ID,
    sequence = 2,
    origin: 'live_transport' | 'accepted_recovery' = 'live_transport',
): ConversationStreamEvent {
    return event(
        sequence,
        {
            type: 'response_accepted' as const,
            origin,
            conversation: { conversation_id: 'conversation:sdk', revision: 2 },
            operation_receipt_id: 'receipt:sdk',
            committed_turn_id: 'turn:accepted',
            turn_status: 'completed' as const,
            generation_status: 'completed' as const,
            committed_block_ids: ['block:accepted'],
            accepted_asset_ids: [],
            reconciliations: [],
        },
        streamId,
    );
}

function opened(streamId = STREAM_ID): ExperimentalCanonicalInteractionStreamEnvelope {
    return {
        api_version: API_VERSION,
        type: 'stream_opened',
        run_id: RUN_ID,
        operation_id: request.operation_id,
        stream_id: streamId,
    };
}

function wrapped(streamEvent: ConversationStreamEvent) {
    return {
        api_version: API_VERSION,
        type: 'conversation_event' as const,
        run_id: RUN_ID,
        host_status:
            streamEvent.type === 'response_accepted'
                ? ('accepted' as const)
                : streamEvent.type === 'stream_terminated'
                  ? ('terminated' as const)
                  : ('provisional' as const),
        event: streamEvent,
    };
}

describe('canonical interaction stream SDK session', () => {
    it('keeps one verified accumulator across a clean reconnect', async () => {
        const requests: ExperimentalCanonicalInteractionStreamRequest[] = [];
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn(async (wireRequest, emit) => {
                requests.push(wireRequest);
                if (requests.length === 1) {
                    emit(opened());
                    emit(wrapped(draftStarted()));
                    return;
                }
                emit({
                    ...opened(),
                    type: 'stream_resumed',
                    resumed_after: wireRequest.resume_after,
                });
                emit(wrapped(draftFinished()));
                emit(wrapped(accepted()));
            }),
        };

        const result = await consumeCanonicalInteractionStream(transport, request);

        expect(requests).toHaveLength(2);
        expect(requests[0].resume_after).toBeUndefined();
        expect(requests[1].resume_after).toEqual({ stream_id: STREAM_ID, event_id: `${STREAM_ID}#0`, sequence: 0 });
        expect(result.terminal_event.type).toBe('response_accepted');
        expect(result.retained_events.map((item) => item.sequence)).toEqual([0, 1, 2]);
    });

    it('requires a verified retained prefix for an external resume cursor', async () => {
        const resumeRequest = {
            ...request,
            resume_after: { stream_id: STREAM_ID, event_id: `${STREAM_ID}#0`, sequence: 0 },
        };
        const transport = { connect: vi.fn() } satisfies CanonicalInteractionStreamTransport;

        await expect(consumeCanonicalInteractionStream(transport, resumeRequest)).rejects.toThrow(
            'requires both resume_after and retained_events',
        );
        expect(transport.connect).not.toHaveBeenCalled();
    });

    it('resets provisional drafts only after an explicit distinct accepted-recovery envelope', async () => {
        const prefix = [draftStarted()];
        const recoveryStreamId = 'stream:recovery';
        const resumeRequest = {
            ...request,
            resume_after: { stream_id: STREAM_ID, event_id: `${STREAM_ID}#0`, sequence: 0 },
        };
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn(async (_wireRequest, emit) => {
                emit({
                    api_version: API_VERSION,
                    type: 'accepted_recovery_opened',
                    run_id: RUN_ID,
                    operation_id: request.operation_id,
                    stream_id: recoveryStreamId,
                    replaces_stream_id: STREAM_ID,
                });
                emit(wrapped(accepted(recoveryStreamId, 0, 'accepted_recovery')));
            }),
        };

        const result = await consumeCanonicalInteractionStream(transport, resumeRequest, { retained_events: prefix });

        expect(result.stream_id).toBe(recoveryStreamId);
        expect(result.retained_events).toHaveLength(1);
        expect(result.terminal_event).toMatchObject({ type: 'response_accepted', origin: 'accepted_recovery' });
    });

    it('suppresses replayed event callbacks while retaining exact cursor verification', async () => {
        const prefix = [draftStarted()];
        const resumeRequest = {
            ...request,
            resume_after: { stream_id: STREAM_ID, event_id: `${STREAM_ID}#0`, sequence: 0 },
        };
        const observed: ExperimentalCanonicalInteractionStreamEnvelope[] = [];
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn(async (wireRequest, emit) => {
                emit({ ...opened(), type: 'stream_resumed', resumed_after: wireRequest.resume_after });
                emit(wrapped(draftStarted()));
                emit(wrapped(draftFinished()));
                emit(wrapped(accepted()));
            }),
        };

        const result = await consumeCanonicalInteractionStream(transport, resumeRequest, {
            retained_events: prefix,
            on_envelope: (envelope) => observed.push(envelope),
        });

        expect(result.retained_events.map((item) => item.sequence)).toEqual([0, 1, 2]);
        expect(observed.filter((envelope) => envelope.type === 'conversation_event')).toHaveLength(2);
    });

    it('does not regress the reconnect cursor after an older exact duplicate', async () => {
        const prefix = [draftStarted(), draftFinished()];
        const requests: ExperimentalCanonicalInteractionStreamRequest[] = [];
        const resumeRequest = {
            ...request,
            resume_after: { stream_id: STREAM_ID, event_id: `${STREAM_ID}#1`, sequence: 1 },
        };
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn(async (wireRequest, emit) => {
                requests.push(wireRequest);
                emit({ ...opened(), type: 'stream_resumed', resumed_after: wireRequest.resume_after });
                if (requests.length === 1) {
                    emit(wrapped(draftStarted()));
                    return;
                }
                emit(wrapped(accepted()));
            }),
        };

        await consumeCanonicalInteractionStream(transport, resumeRequest, { retained_events: prefix });

        expect(requests).toHaveLength(2);
        expect(requests[1].resume_after).toEqual({
            stream_id: STREAM_ID,
            event_id: `${STREAM_ID}#1`,
            sequence: 1,
        });
    });

    it('treats callback exceptions as terminal consumer failures without reconnecting', async () => {
        const failure = new Error('consumer rendering failed');
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn(async (_wireRequest, emit) => {
                emit(opened());
                emit(wrapped(draftStarted()));
            }),
        };

        await expect(
            consumeCanonicalInteractionStream(transport, request, {
                on_envelope: (envelope) => {
                    if (envelope.type === 'conversation_event') throw failure;
                },
            }),
        ).rejects.toMatchObject({ name: 'CanonicalInteractionStreamConsumerError', cause: failure });
        expect(transport.connect).toHaveBeenCalledOnce();
    });

    it('returns a verified accepted terminal when the transport fails afterward without reconnecting', async () => {
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn(async (_wireRequest, emit) => {
                emit(opened());
                emit(wrapped(accepted(STREAM_ID, 0)));
                throw new Error('socket closed after terminal delivery');
            }),
        };

        const result = await consumeCanonicalInteractionStream(transport, request);

        expect(result.terminal_event.type).toBe('response_accepted');
        expect(transport.connect).toHaveBeenCalledOnce();
    });

    it.each([
        {
            name: 'a cursor from another stream',
            control: {
                ...opened(),
                type: 'stream_resumed' as const,
                resumed_after: { stream_id: 'stream:other', event_id: `${STREAM_ID}#0`, sequence: 0 },
            },
        },
        {
            name: 'a recovery that reuses the replaced stream ID',
            control: {
                ...opened(),
                type: 'accepted_recovery_opened' as const,
                replaces_stream_id: STREAM_ID,
            },
        },
    ])('rejects $name', async ({ control }) => {
        const prefix = [draftStarted()];
        const resumeRequest = {
            ...request,
            resume_after: { stream_id: STREAM_ID, event_id: `${STREAM_ID}#0`, sequence: 0 },
        };
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn(async (_wireRequest, emit) => emit(control)),
        };

        await expect(
            consumeCanonicalInteractionStream(transport, resumeRequest, { retained_events: prefix }),
        ).rejects.toThrow('protocol failed');
        expect(transport.connect).toHaveBeenCalledOnce();
    });

    it.each([
        { ...opened(), type: 'unknown' },
        { ...opened(), extra: true },
        { ...wrapped(draftStarted()), host_status: 'accepted' },
    ])('rejects an envelope outside the exact generated contract %#', async (invalid) => {
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn(async (_wireRequest, emit) => emit(invalid)),
        };

        await expect(consumeCanonicalInteractionStream(transport, request)).rejects.toThrow('protocol failed');
        expect(transport.connect).toHaveBeenCalledOnce();
    });

    it('rejects accessor input before invoking it', async () => {
        let reads = 0;
        const invalid = Object.defineProperty({}, 'type', {
            enumerable: true,
            get() {
                reads += 1;
                return 'stream_opened';
            },
        });
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn(async (_wireRequest, emit) => emit(invalid)),
        };

        await expect(consumeCanonicalInteractionStream(transport, request)).rejects.toThrow('protocol failed');
        expect(reads).toBe(0);
    });

    it('reconnects a public RunsApi stream after an actual status-zero ConnectionError', async () => {
        const requests: Request[] = [];
        const envelopes = [opened(), wrapped(accepted(STREAM_ID, 0))];
        const body = envelopes.map((envelope) => `data: ${JSON.stringify(envelope)}\n\n`).join('');
        const fetch = vi
            .fn()
            .mockRejectedValueOnce(new Error('socket reset'))
            .mockResolvedValueOnce(new Response(body, { headers: { 'content-type': 'text/event-stream' } }));
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch,
            onRequest: (wireRequest) => requests.push(wireRequest.clone()),
        });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const result = await client.runs.streamCanonical(request, { max_reconnects: 1 });
            expect(result.terminal_event.type).toBe('response_accepted');
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(requests).toHaveLength(2);
            expect(await requests[0].json()).toEqual(request);
            expect(await requests[1].json()).toEqual(request);
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('stops retrying status-zero connection failures after the bounded reconnect budget', async () => {
        const connection = new ConnectionError(
            new Request('https://studio.example.com/api/v1/runs/canonical-stream'),
            new Error('offline'),
        );
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn().mockRejectedValue(connection),
        };

        await expect(consumeCanonicalInteractionStream(transport, request, { max_reconnects: 1 })).rejects.toBe(
            connection,
        );
        expect(transport.connect).toHaveBeenCalledTimes(2);
    });

    it('does not reconnect HTTP 409 response errors', async () => {
        const conflict = new ServerError(
            'request binding conflict',
            new Request('https://studio.example.com/api/v1/runs/canonical-stream'),
            409,
            { errorCode: 'canonical_request_mismatch' },
        );
        const transport: CanonicalInteractionStreamTransport = {
            connect: vi.fn().mockRejectedValue(conflict),
        };

        await expect(consumeCanonicalInteractionStream(transport, request, { max_reconnects: 2 })).rejects.toBe(
            conflict,
        );
        expect(transport.connect).toHaveBeenCalledOnce();
    });

    it('preserves sealed initial tags while ordinary streams retain session decoration', async () => {
        const requests: Request[] = [];
        const body = [opened(), wrapped(accepted(STREAM_ID, 0))]
            .map((envelope) => `data: ${JSON.stringify(envelope)}\n\n`)
            .join('');
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            sessionTags: ['session:late'],
            fetch: vi.fn(async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } })),
            onRequest: (wire) => requests.push(wire.clone()),
        });
        const initial: ExperimentalCanonicalInteractionStreamRequest = {
            kind: 'initial_agent',
            operation_id: request.operation_id,
            request: {
                interaction: 'stream-test',
                initial_state: {
                    type: 'document',
                    document: createConversationDocument({
                        id: 'conversation:initial',
                        created_at: '2026-10-03T00:00:00Z',
                    }),
                },
                retention: RunDataStorageLevel.DEBUG,
                return_policy: { history: 'none' },
                tags: ['scheduled:one'],
            },
            agent_acceptance: { version: 1, subject_agent_run_id: 'subject', scope: 'root', activity_id: 'activity' },
            activity_delivery: { activity_id: 'activity', run_id: 'actual:run', task_token: 'opaque-token' },
        };
        await client.runs.streamCanonical(initial);
        await client.runs.streamCanonical({ ...request, request: { ...request.request, tags: ['ordinary:one'] } });
        expect(await requests[0].json()).toEqual(initial);
        expect((await requests[1].json()).request.tags).toEqual(['session:late', 'ordinary:one']);
        expect(initial.request.tags).toEqual(['scheduled:one']);
    });

    it('uses the exact versioned endpoint and parses the finite accepted event', async () => {
        const requests: Request[] = [];
        const envelopes = [opened(), wrapped(accepted(STREAM_ID, 0))];
        const body = envelopes.map((envelope) => `data: ${JSON.stringify(envelope)}\n\n`).join('');
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } })),
            onRequest: (wireRequest) => requests.push(wireRequest.clone()),
        });

        const result = await client.runs.streamCanonical(request);

        expect(result.terminal_event.type).toBe('response_accepted');
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('POST');
        expect(new URL(requests[0].url).pathname).toBe('/api/v1/runs/canonical-stream');
        expect(requests[0].headers.get(VERSION_HEADER)).toBe(API_VERSION);
        expect(await requests[0].json()).toEqual(request);
    });
});

function initialIngestionRequest(): Extract<ExperimentalCanonicalInteractionStreamRequest, { kind: 'initial_agent' }> {
    return {
        kind: 'initial_agent',
        operation_id: request.operation_id,
        request: {
            interaction: 'stream-test',
            initial_state: {
                type: 'document',
                document: createConversationDocument({
                    id: 'conversation:initial',
                    created_at: '2026-10-04T00:00:00Z',
                }),
            },
            retention: RunDataStorageLevel.DEBUG,
            return_policy: { history: 'none' },
        },
        agent_acceptance: { version: 1, subject_agent_run_id: 'subject', scope: 'root', activity_id: 'activity' },
        activity_delivery: { activity_id: 'activity', run_id: 'actual:run', task_token: 'opaque-token' },
    };
}

describe('initial-only targetless ingestion delivery', () => {
    const ack = () => ({
        api_version: API_VERSION,
        type: 'ingestion_accepted' as const,
        run_id: RUN_ID,
        operation_id: request.operation_id,
        accepted_source: { conversation_id: 'conversation:initial', revision: 1 },
    });
    it('accepts an input ACK without inventing model stream/cursor/response authority', async () => {
        const envelope = ack();
        const transport = {
            connect: vi.fn(async (_request, onEnvelope) => onEnvelope(envelope)),
        } satisfies CanonicalInteractionStreamTransport;
        const result = await consumeCanonicalInteractionStream(transport, initialIngestionRequest(), {
            on_envelope: () => {
                envelope.accepted_source.revision = 99;
            },
        });
        expect(result).toEqual({ run_id: RUN_ID, operation_id: request.operation_id, terminal_event: ack() });
        expect(result).not.toHaveProperty('stream_id');
        expect(result).not.toHaveProperty('cursor');
        expect(result).not.toHaveProperty('retained_events');
        expect(transport.connect).toHaveBeenCalledOnce();
    });
    it('rejects ordinary, wrong-operation and model-event mixed ACKs without reconnect', async () => {
        for (const [payload, envelopes] of [
            [request, [ack()]],
            [initialIngestionRequest(), [{ ...ack(), operation_id: 'other' }]],
            [initialIngestionRequest(), [opened(), ack()]],
            [initialIngestionRequest(), [ack(), opened()]],
        ] satisfies Array<
            [ExperimentalCanonicalInteractionStreamRequest, ExperimentalCanonicalInteractionStreamEnvelope[]]
        >) {
            const transport = {
                connect: vi.fn(async (_request, onEnvelope) => {
                    for (const envelope of envelopes) onEnvelope(envelope);
                }),
            } satisfies CanonicalInteractionStreamTransport;
            await expect(consumeCanonicalInteractionStream(transport, payload)).rejects.toThrow('protocol failed');
            expect(transport.connect).toHaveBeenCalledOnce();
        }
    });
    it('recovers delivery-only ACK after connection error without making another provider stream', async () => {
        const transport = {
            connect: vi.fn(async (_request, onEnvelope) => {
                onEnvelope(ack());
                throw new Error('socket closed after input ACK');
            }),
        } satisfies CanonicalInteractionStreamTransport;
        const result = await consumeCanonicalInteractionStream(transport, initialIngestionRequest());
        expect(result.terminal_event.type).toBe('ingestion_accepted');
        expect(transport.connect).toHaveBeenCalledOnce();
    });
});

describe('stream request overloads preserve input ACK versus model response typing', () => {
    it('keeps initial and union callers broad, ordinary callers model-only, for consumer and SDK', async () => {
        const initial = initialIngestionRequest();
        const ordinary: Exclude<ExperimentalCanonicalInteractionStreamRequest, { kind: 'initial_agent' }> & {
            kind?: 'tool_approval_review';
        } = request;
        const envelopes = (payload: ExperimentalCanonicalInteractionStreamRequest) =>
            'kind' in payload && payload.kind === 'initial_agent'
                ? [
                      {
                          api_version: API_VERSION,
                          type: 'ingestion_accepted' as const,
                          run_id: RUN_ID,
                          operation_id: payload.operation_id,
                          accepted_source: { conversation_id: 'conversation:initial', revision: 1 },
                      },
                  ]
                : [opened(), wrapped(accepted(STREAM_ID, 0))];
        const transport: CanonicalInteractionStreamTransport = {
            connect: async (payload, onEnvelope) => {
                for (const envelope of envelopes(payload)) onEnvelope(envelope);
            },
        };
        const initialConsumer = consumeCanonicalInteractionStream(transport, initial);
        const ordinaryConsumer = consumeCanonicalInteractionStream(transport, ordinary);
        expectTypeOf(initialConsumer).toEqualTypeOf<Promise<CanonicalInitialInteractionStreamResult>>();
        expectTypeOf(ordinaryConsumer).toEqualTypeOf<Promise<CanonicalInteractionStreamResult>>();
        const consumeUnion = (payload: ExperimentalCanonicalInteractionStreamRequest) => {
            const result = consumeCanonicalInteractionStream(transport, payload);
            expectTypeOf(result).toEqualTypeOf<Promise<CanonicalInitialInteractionStreamResult>>();
            return result;
        };
        expect((await initialConsumer).terminal_event.type).toBe('ingestion_accepted');
        expect((await ordinaryConsumer).terminal_event.type).toBe('response_accepted');
        expect((await consumeUnion(initial)).terminal_event.type).toBe('ingestion_accepted');
        expect((await consumeUnion(ordinary)).terminal_event.type).toBe('response_accepted');

        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async (wire, init) => {
                const payload: ExperimentalCanonicalInteractionStreamRequest = await new Request(wire, init).json();
                const body = envelopes(payload)
                    .map((envelope) => `data: ${JSON.stringify(envelope)}\n\n`)
                    .join('');
                return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
            }),
        });
        const initialSdk = client.runs.streamCanonical(initial);
        const ordinarySdk = client.runs.streamCanonical(ordinary);
        expectTypeOf(initialSdk).toEqualTypeOf<Promise<CanonicalInitialInteractionStreamResult>>();
        expectTypeOf(ordinarySdk).toEqualTypeOf<Promise<CanonicalInteractionStreamResult>>();
        const sdkUnion = (payload: ExperimentalCanonicalInteractionStreamRequest) => {
            const result = client.runs.streamCanonical(payload);
            expectTypeOf(result).toEqualTypeOf<Promise<CanonicalInitialInteractionStreamResult>>();
            return result;
        };
        expect((await initialSdk).terminal_event.type).toBe('ingestion_accepted');
        expect((await ordinarySdk).terminal_event.type).toBe('response_accepted');
        expect((await sdkUnion(initial)).terminal_event.type).toBe('ingestion_accepted');
        expect((await sdkUnion(ordinary)).terminal_event.type).toBe('response_accepted');
    });
});
