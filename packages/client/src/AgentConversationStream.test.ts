import {
    appendConversationRecords,
    createAcceptedOutputFragment,
    createConversationDocument,
    type Generation,
} from '@llumiverse/conversation';
import type {
    ConversationOutputReceipt,
    ConversationStreamEvent,
    ExperimentalAgentConversationStreamEnvelope,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { type AgentConversationStreamTransport, consumeAgentConversationStream } from './AgentConversationStream.js';
import { CanonicalInteractionOutput } from './CanonicalInteractionOutput.js';

const API_VERSION = '=20260930' as const;
const AGENT_RUN_ID = 'agent:run-1';
const STREAM_ID = 'stream:agent-1';
const RECORDED_AT = '2026-10-01T00:00:00.000Z';

function eventBase(sequence: number, streamId = STREAM_ID) {
    return {
        format: 'llumiverse.conversation' as const,
        schema_version: 0 as const,
        experimental_revision: '2026-09-30.adoption.1' as const,
        stream_id: streamId,
        request_id: 'request:agent-1',
        attempt_id: 'attempt:agent-1',
        response_operation_id: 'operation:response-1',
        generation_id: 'generation:agent-1',
        draft_turn_id: 'turn:draft-1',
        event_id: `${streamId}#${sequence}`,
        sequence,
    };
}

function draftStarted(streamId = STREAM_ID): ConversationStreamEvent {
    return { ...eventBase(0, streamId), type: 'draft_started', origin: 'live_transport' };
}

function draftFinished(streamId = STREAM_ID, sequence = 1): ConversationStreamEvent {
    return { ...eventBase(sequence, streamId), type: 'draft_finished', outcome: 'completed', finish_reason: 'stop' };
}

function streamTerminated(streamId: string): ConversationStreamEvent {
    return { ...eventBase(1, streamId), type: 'stream_terminated', outcome: 'failed' };
}

function draftTextDelta(sequence: number, streamId = STREAM_ID): ConversationStreamEvent {
    return {
        ...eventBase(sequence, streamId),
        type: 'draft_text_delta',
        draft_block_id: 'block:text',
        native_position: { protocol: 'test', path: ['parts', 0] },
        text: 'suffix',
    };
}

function draftTextBlockStarted(sequence: number, streamId = STREAM_ID): ConversationStreamEvent {
    return {
        ...eventBase(sequence, streamId),
        type: 'draft_block_started',
        draft_block_id: 'block:text',
        native_position: { protocol: 'test', path: ['parts', 0] },
        block: { type: 'text' },
    };
}

function envelope(streamEvent: ConversationStreamEvent): ExperimentalAgentConversationStreamEnvelope {
    return {
        api_version: API_VERSION,
        agent_run_id: AGENT_RUN_ID,
        scope: 'root',
        type: 'conversation_event',
        execution_run_id: 'execution:run-1',
        event: streamEvent,
    };
}

function preview(
    reason: 'live_only' | 'late_join' | 'sequence_gap' = 'live_only',
): ExperimentalAgentConversationStreamEnvelope {
    return {
        api_version: API_VERSION,
        agent_run_id: AGENT_RUN_ID,
        scope: 'root',
        type: 'preview_unavailable',
        reason,
    };
}

function acceptedOutput(): CanonicalInteractionOutput<unknown> {
    const initial = createConversationDocument({ id: 'conversation:agent-1', created_at: RECORDED_AT });
    const generation = {
        id: 'generation:accepted',
        record_source: 'executed' as const,
        request_id: 'request:accepted',
        attempt_id: 'attempt:accepted',
        purpose: 'interaction',
        requested_model: 'test-model',
        provider: 'test-provider',
        protocol: 'test-protocol',
        adapter_version: 'test-adapter',
        status: 'completed' as const,
        finish_reason: 'stop',
        timestamps: { recorded_at: RECORDED_AT, completed_at: RECORDED_AT },
        source: { conversation_id: initial.id, revision: initial.revision },
        request_receipt: {
            id: 'request-receipt:accepted',
            request_id: 'request:accepted',
            attempt_id: 'attempt:accepted',
            source: { conversation_id: initial.id, revision: initial.revision },
            context_fingerprint: 'context-fingerprint',
            tool_set_fingerprint: 'tool-set-fingerprint',
            request_fingerprint: 'request-fingerprint',
            target: {
                provider: 'test-provider',
                protocol: 'test-protocol',
                model: 'test-model',
                adapter_version: 'test-adapter',
            },
            tool_definition_ids: [],
            asset_versions: [],
            item_mappings: [],
            recorded_at: RECORDED_AT,
        },
    } satisfies Generation;
    const document = appendConversationRecords(
        initial,
        {
            turns: [
                {
                    id: 'turn:accepted',
                    kind: 'agent',
                    authority: 'ordinary',
                    status: 'completed',
                    timestamps: { recorded_at: RECORDED_AT, completed_at: RECORDED_AT },
                    model_visibility: 'include',
                    provenance: { type: 'generated' },
                    generation_id: generation.id,
                    blocks: [{ id: 'block:text', type: 'text', text: 'accepted answer', format: 'plain' }],
                },
            ],
            generations: [generation],
        },
        {
            expected_revision: initial.revision,
            operation_id: 'response:accepted',
            payload_fingerprint: 'response-fingerprint',
            recorded_at: RECORDED_AT,
        },
    ).document;
    return new CanonicalInteractionOutput(createAcceptedOutputFragment(document, 'response:accepted'));
}

function acceptedEnvelope(receipt: ConversationOutputReceipt): ExperimentalAgentConversationStreamEnvelope {
    return {
        api_version: API_VERSION,
        agent_run_id: AGENT_RUN_ID,
        scope: 'root',
        type: 'accepted_output',
        source: { conversation_id: receipt.conversation_id, revision: receipt.result_revision },
        receipt,
    };
}

describe('agent conversation canonical stream consumer', () => {
    it('publishes immutable canonical draft snapshots after each typed event', async () => {
        const abort = new AbortController();
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit, signal) => {
                emit(preview());
                emit(envelope(draftStarted()));
                emit(envelope(draftTextBlockStarted(1)));
                emit(envelope(draftTextDelta(2)));
                await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
            }),
            retrieveAcceptedOutput: vi.fn(),
        };
        const snapshots: Array<readonly { text?: string }[]> = [];

        await consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            signal: abort.signal,
            on_update: (update) => {
                if (update.type !== 'conversation_event') return;
                expect(update.draft_snapshot).toBeDefined();
                snapshots.push(update.draft_snapshot ?? []);
                if (update.event.type === 'draft_text_delta') abort.abort();
            },
        });

        expect(snapshots).toHaveLength(3);
        expect(snapshots[0]).toEqual([]);
        expect(snapshots[1]).toEqual([
            expect.objectContaining({ draft_block_id: 'block:text', type: 'text', text: '' }),
        ]);
        expect(snapshots[2]).toEqual([
            expect.objectContaining({ draft_block_id: 'block:text', type: 'text', text: 'suffix' }),
        ]);
        expect(Object.isFrozen(snapshots[2])).toBe(true);
        expect(Object.isFrozen(snapshots[2]?.[0])).toBe(true);
    });

    it('clears preview on reconnect and resolves accepted output through its exact receipt', async () => {
        const output = acceptedOutput();
        const connections: ExperimentalAgentConversationStreamEnvelope[][] = [
            [preview(), envelope(draftStarted())],
            [preview('late_join'), acceptedEnvelope(output.fragment.receipt)],
        ];
        let connection = 0;
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit) => {
                for (const item of connections[connection++]) emit(item);
            }),
            retrieveAcceptedOutput: vi.fn(async () => output),
        };
        const updates: string[] = [];
        const abort = new AbortController();

        await consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            max_reconnects: 1,
            reconnect_delay_ms: 0,
            signal: abort.signal,
            on_update: (update) => {
                updates.push(update.type === 'conversation_event' ? update.event.type : update.type);
                if (update.type === 'accepted_output') abort.abort();
            },
        });

        expect(updates).toEqual(['preview_unavailable', 'draft_started', 'preview_unavailable', 'accepted_output']);
        expect(transport.connect).toHaveBeenCalledTimes(2);
        expect(transport.retrieveAcceptedOutput).toHaveBeenCalledWith(
            expect.objectContaining({ receipt: output.fragment.receipt }),
            expect.any(AbortSignal),
        );
    });

    it('rejects accepted output returned by a custom transport under a different receipt', async () => {
        const output = acceptedOutput();
        const announcedReceipt = structuredClone(output.fragment.receipt);
        announcedReceipt.id = 'response:tampered';
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit) => {
                emit(preview());
                emit(acceptedEnvelope(announcedReceipt));
            }),
            retrieveAcceptedOutput: vi.fn(async () => output),
        };

        await expect(
            consumeAgentConversationStream(transport, {
                agent_run_id: AGENT_RUN_ID,
                max_reconnects: 0,
                on_update: vi.fn(),
            }),
        ).rejects.toThrow('does not match its announced receipt');
    });

    it('rejects a midstream suffix after preview reset instead of accumulating missing content', async () => {
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit) => {
                emit(preview('sequence_gap'));
                emit(envelope(draftTextDelta(1)));
            }),
            retrieveAcceptedOutput: vi.fn(),
        };

        const updates = vi.fn();
        await expect(
            consumeAgentConversationStream(transport, {
                agent_run_id: AGENT_RUN_ID,
                max_reconnects: 0,
                on_update: updates,
            }),
        ).rejects.toThrow('exact prefix');
        expect(updates).toHaveBeenLastCalledWith(
            expect.objectContaining({
                type: 'preview_unavailable',
                reason: 'sequence_gap',
            }),
        );
        expect(transport.connect).toHaveBeenCalledOnce();
    });

    it('requires every connection to clear provisional preview before publishing drafts', async () => {
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit) => emit(envelope(draftStarted()))),
            retrieveAcceptedOutput: vi.fn(),
        };

        await expect(
            consumeAgentConversationStream(transport, {
                agent_run_id: AGENT_RUN_ID,
                max_reconnects: 0,
                on_update: vi.fn(),
            }),
        ).rejects.toThrow('did not begin by clearing');
    });

    it('owns queued envelopes while an earlier update callback is pending', async () => {
        const abort = new AbortController();
        let releaseFirstUpdate: () => void = () => {};
        const firstUpdatePending = new Promise<void>((resolve) => {
            releaseFirstUpdate = resolve;
        });
        const mutableDraft = envelope(draftStarted());
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit) => {
                emit(preview());
                emit(mutableDraft);
                if (mutableDraft.type !== 'conversation_event') throw new Error('Expected conversation event fixture');
                mutableDraft.event = { ...mutableDraft.event, type: 'stream_terminated', outcome: 'failed' };
                releaseFirstUpdate();
            }),
            retrieveAcceptedOutput: vi.fn(),
        };
        const updates: string[] = [];

        await consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            max_reconnects: 0,
            signal: abort.signal,
            on_update: async (update) => {
                updates.push(update.type === 'conversation_event' ? update.event.type : update.type);
                if (updates.length === 1) await firstUpdatePending;
                if (update.type === 'conversation_event') abort.abort();
            },
        });

        expect(updates).toEqual(['preview_unavailable', 'draft_started']);
        expect(mutableDraft).toMatchObject({
            type: 'conversation_event',
            event: { type: 'stream_terminated' },
        });
    });

    it('pins an omitted scope from the first authorized envelope and rejects later scope changes', async () => {
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit) => {
                emit({ ...preview(), scope: 'workstream:child-1', workstream_id: 'child' });
                emit({ ...preview(), scope: 'workstream:sibling-1', workstream_id: 'child' });
            }),
            retrieveAcceptedOutput: vi.fn(),
        };

        await expect(
            consumeAgentConversationStream(transport, {
                agent_run_id: AGENT_RUN_ID,
                max_reconnects: 0,
                on_update: vi.fn(),
            }),
        ).rejects.toThrow('changed scope');
    });

    it('settles caller cancellation when a custom transport connect ignores abort forever', async () => {
        const abort = new AbortController();
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(() => new Promise<void>(() => {})),
            retrieveAcceptedOutput: vi.fn(),
        };
        const pending = consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            signal: abort.signal,
            on_update: vi.fn(),
        });

        await Promise.resolve();
        abort.abort();
        await expect(pending).resolves.toBeUndefined();
    });

    it('settles caller cancellation when an update callback ignores abort forever', async () => {
        const abort = new AbortController();
        let startedUpdate: () => void = () => {};
        const updateStarted = new Promise<void>((resolve) => {
            startedUpdate = resolve;
        });
        const never = new Promise<void>(() => {});
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit, signal) => {
                emit(preview());
                await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
            }),
            retrieveAcceptedOutput: vi.fn(),
        };
        const pending = consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            signal: abort.signal,
            on_update: () => {
                startedUpdate();
                return never;
            },
        });

        await updateStarted;
        abort.abort();
        await expect(pending).resolves.toBeUndefined();
    });

    it('settles caller cancellation when exact accepted-output retrieval ignores abort forever', async () => {
        const output = acceptedOutput();
        const abort = new AbortController();
        let startedRetrieval: () => void = () => {};
        const retrievalStarted = new Promise<void>((resolve) => {
            startedRetrieval = resolve;
        });
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit, signal) => {
                emit(preview());
                emit(acceptedEnvelope(output.fragment.receipt));
                await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
            }),
            retrieveAcceptedOutput: vi.fn(() => {
                startedRetrieval();
                return new Promise<CanonicalInteractionOutput<unknown>>(() => {});
            }),
        };
        const pending = consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            signal: abort.signal,
            on_update: vi.fn(),
        });

        await retrievalStarted;
        abort.abort();
        await expect(pending).resolves.toBeUndefined();
    });

    it('does not redeliver the same exact accepted receipt after reconnect', async () => {
        const output = acceptedOutput();
        const abort = new AbortController();
        let connections = 0;
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit) => {
                connections += 1;
                emit(preview(connections === 1 ? 'live_only' : 'late_join'));
                emit(acceptedEnvelope(output.fragment.receipt));
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
                if (connections === 2) abort.abort();
            }),
            retrieveAcceptedOutput: vi.fn(async () => output),
        };
        const acceptedUpdates: string[] = [];

        await consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            max_reconnects: 1,
            reconnect_delay_ms: 0,
            signal: abort.signal,
            on_update: (update) => {
                if (update.type === 'accepted_output') acceptedUpdates.push(update.output.text());
            },
        });

        expect(acceptedUpdates).toEqual(['accepted answer']);
        expect(transport.retrieveAcceptedOutput).toHaveBeenCalledOnce();
    });

    it('does not let an older accepted response clear a newer provisional stream', async () => {
        const output = acceptedOutput();
        const abort = new AbortController();
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit, signal) => {
                emit(preview());
                emit(envelope(draftStarted('stream:new')));
                emit(envelope(draftTextBlockStarted(1, 'stream:new')));
                emit(acceptedEnvelope(output.fragment.receipt));
                emit(envelope(draftTextDelta(2, 'stream:new')));
                await new Promise<void>((resolve) => {
                    if (signal.aborted) resolve();
                    else signal.addEventListener('abort', () => resolve(), { once: true });
                });
            }),
            retrieveAcceptedOutput: vi.fn(async () => output),
        };
        const updates: string[] = [];
        let acceptedDraftBlockId: string | undefined;

        await consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            signal: abort.signal,
            on_update: (update) => {
                updates.push(update.type === 'conversation_event' ? update.event.type : update.type);
                if (update.type === 'accepted_output') {
                    expect(update.draft_snapshot).toBeDefined();
                    acceptedDraftBlockId = update.draft_snapshot?.[0]?.draft_block_id;
                }
                if (update.type === 'conversation_event' && update.event.type === 'draft_text_delta') abort.abort();
            },
        });

        expect(updates).toEqual([
            'preview_unavailable',
            'draft_started',
            'draft_block_started',
            'accepted_output',
            'draft_text_delta',
        ]);
        expect(acceptedDraftBlockId).toBe('block:text');
    });

    it('does not let a stale terminal clear a newer stream for the same execution', async () => {
        const abort = new AbortController();
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit, signal) => {
                emit(preview());
                emit(envelope(draftStarted('stream:new')));
                emit(envelope(streamTerminated('stream:old')));
                emit(envelope(draftFinished('stream:new')));
                await new Promise<void>((resolve) => {
                    if (signal.aborted) resolve();
                    else signal.addEventListener('abort', () => resolve(), { once: true });
                });
            }),
            retrieveAcceptedOutput: vi.fn(),
        };
        const events: string[] = [];

        await consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            signal: abort.signal,
            on_update: (update) => {
                if (update.type === 'conversation_event') {
                    events.push(`${update.event.stream_id}:${update.event.type}`);
                    if (update.event.type === 'draft_finished') abort.abort();
                }
            },
        });

        expect(events).toEqual([
            'stream:new:draft_started',
            'stream:old:stream_terminated',
            'stream:new:draft_finished',
        ]);
    });

    it('clears an older provisional preview before accepting a new stream prefix', async () => {
        const abort = new AbortController();
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit, signal) => {
                emit(preview());
                emit(envelope(draftStarted('stream:old')));
                emit(envelope(draftStarted('stream:new')));
                emit(envelope(draftFinished('stream:new')));
                await new Promise<void>((resolve) => {
                    if (signal.aborted) resolve();
                    else signal.addEventListener('abort', () => resolve(), { once: true });
                });
            }),
            retrieveAcceptedOutput: vi.fn(),
        };
        const updates: string[] = [];

        await consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            signal: abort.signal,
            on_update: (update) => {
                if (update.type === 'conversation_event')
                    updates.push(`${update.event.stream_id}:${update.event.type}`);
                else if (update.type === 'preview_unavailable') updates.push(`${update.type}:${update.reason}`);
                else updates.push(update.type);
                if (update.type === 'conversation_event' && update.event.type === 'draft_finished') abort.abort();
            },
        });

        expect(updates).toEqual([
            'preview_unavailable:live_only',
            'stream:old:draft_started',
            'preview_unavailable:sequence_gap',
            'stream:new:draft_started',
            'stream:new:draft_finished',
        ]);
    });

    it('consumes global resets produced by interleaved server executions without reusing a hidden prefix', async () => {
        const abort = new AbortController();
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit, signal) => {
                emit(preview());
                emit(envelope(draftStarted('stream:a')));
                emit(preview('sequence_gap'));
                emit(envelope(draftStarted('stream:b')));
                emit(preview('sequence_gap'));
                await new Promise<void>((resolve) => {
                    if (signal.aborted) resolve();
                    else signal.addEventListener('abort', () => resolve(), { once: true });
                });
            }),
            retrieveAcceptedOutput: vi.fn(),
        };
        const updates: string[] = [];

        await consumeAgentConversationStream(transport, {
            agent_run_id: AGENT_RUN_ID,
            signal: abort.signal,
            on_update: (update) => {
                if (update.type === 'conversation_event') updates.push(update.event.stream_id);
                else if (update.type === 'preview_unavailable') updates.push(update.reason);
                else updates.push(update.type);
                if (update.type === 'preview_unavailable' && updates.length === 5) abort.abort();
            },
        });

        expect(updates).toEqual(['live_only', 'stream:a', 'sequence_gap', 'stream:b', 'sequence_gap']);
    });

    it('does not reconnect consumer failures', async () => {
        const failure = new Error('render failed');
        const transport: AgentConversationStreamTransport = {
            connect: vi.fn(async (emit) => emit(preview())),
            retrieveAcceptedOutput: vi.fn(),
        };

        await expect(
            consumeAgentConversationStream(transport, {
                agent_run_id: AGENT_RUN_ID,
                max_reconnects: 3,
                on_update: () => {
                    throw failure;
                },
            }),
        ).rejects.toMatchObject({ name: 'AgentConversationStreamConsumerError', cause: failure });
        expect(transport.connect).toHaveBeenCalledOnce();
    });
});
