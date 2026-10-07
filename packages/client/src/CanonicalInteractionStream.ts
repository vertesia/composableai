import {
    ConversationStreamAccumulatorRuntime,
    conversationStreamCursor,
} from '@llumiverse/conversation/streaming-runtime';
import type {
    ConversationStreamCursor,
    ConversationStreamEvent,
    ConversationStreamIdentity,
    ExperimentalCanonicalInitialIngestionAccepted,
    ExperimentalCanonicalInteractionConversationEvent,
    ExperimentalCanonicalInteractionStreamEnvelope,
    ExperimentalCanonicalInteractionStreamRequest,
} from '@vertesia/common';
import {
    CanonicalConversationStreamRuntimeValidators,
    parseExperimentalCanonicalInteractionStreamEnvelope,
} from '@vertesia/common/canonical-stream-runtime';

export type CanonicalInteractionStreamTerminalEvent = Extract<
    ConversationStreamEvent,
    { type: 'response_accepted' | 'stream_terminated' }
>;

export interface CanonicalInteractionStreamResult {
    run_id: string;
    operation_id: string;
    stream_id: string;
    terminal_event: CanonicalInteractionStreamTerminalEvent;
    cursor: ConversationStreamCursor;
    retained_events: readonly ConversationStreamEvent[];
}

export interface CanonicalInitialIngestionStreamResult {
    run_id: string;
    operation_id: string;
    terminal_event: ExperimentalCanonicalInitialIngestionAccepted;
    // Ingestion has no model stream, cursor, generation or provider draft events.
}
export type CanonicalInitialInteractionStreamResult =
    | CanonicalInteractionStreamResult
    | CanonicalInitialIngestionStreamResult;

export interface CanonicalInteractionStreamSessionOptions {
    retained_events?: readonly ConversationStreamEvent[];
    max_reconnects?: number;
    on_envelope?: (envelope: ExperimentalCanonicalInteractionStreamEnvelope) => void;
    signal?: AbortSignal;
}

export interface CanonicalInteractionStreamTransport {
    connect(
        request: ExperimentalCanonicalInteractionStreamRequest,
        onEnvelope: (envelope: unknown) => void,
    ): Promise<void>;
}

export class CanonicalInteractionStreamProtocolError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'CanonicalInteractionStreamProtocolError';
    }
}

export class CanonicalInteractionStreamConsumerError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'CanonicalInteractionStreamConsumerError';
    }
}

function streamIdentity(event: ConversationStreamEvent): ConversationStreamIdentity {
    return {
        stream_id: event.stream_id,
        request_id: event.request_id,
        attempt_id: event.attempt_id,
        response_operation_id: event.response_operation_id,
        generation_id: event.generation_id,
        draft_turn_id: event.draft_turn_id,
    };
}

function sameCursor(first: ConversationStreamCursor, second: ConversationStreamCursor): boolean {
    return (
        first.stream_id === second.stream_id && first.event_id === second.event_id && first.sequence === second.sequence
    );
}

function assertHostStatus(envelope: ExperimentalCanonicalInteractionConversationEvent): void {
    const expected =
        envelope.event.type === 'response_accepted'
            ? 'accepted'
            : envelope.event.type === 'stream_terminated'
              ? 'terminated'
              : 'provisional';
    if (envelope.host_status !== expected) {
        throw new Error(`Canonical interaction stream event ${envelope.event.type} has invalid host status`);
    }
}

function reconnectLimit(value: number | undefined): number {
    const limit = value ?? 2;
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 10) {
        throw new RangeError('max_reconnects must be a safe integer between 0 and 10');
    }
    return limit;
}

/**
 * One bounded canonical stream delivery session. Provider events become authoritative only when the host emits the
 * accepted terminal after its persistence barrier; provisional draft events remain delivery-only observations.
 */
export function consumeCanonicalInteractionStream(
    transport: CanonicalInteractionStreamTransport,
    request: Extract<ExperimentalCanonicalInteractionStreamRequest, { kind: 'initial_agent' }>,
    options?: CanonicalInteractionStreamSessionOptions,
): Promise<CanonicalInitialInteractionStreamResult>;
export function consumeCanonicalInteractionStream(
    transport: CanonicalInteractionStreamTransport,
    request: Exclude<ExperimentalCanonicalInteractionStreamRequest, { kind: 'initial_agent' }> & {
        kind?: 'tool_approval_review';
    },
    options?: CanonicalInteractionStreamSessionOptions,
): Promise<CanonicalInteractionStreamResult>;
export function consumeCanonicalInteractionStream(
    transport: CanonicalInteractionStreamTransport,
    request: ExperimentalCanonicalInteractionStreamRequest,
    options?: CanonicalInteractionStreamSessionOptions,
): Promise<CanonicalInitialInteractionStreamResult>;
export async function consumeCanonicalInteractionStream(
    transport: CanonicalInteractionStreamTransport,
    request: ExperimentalCanonicalInteractionStreamRequest,
    options: CanonicalInteractionStreamSessionOptions = {},
): Promise<CanonicalInitialInteractionStreamResult> {
    const retained = options.retained_events;
    if ((request.resume_after === undefined) !== (retained === undefined)) {
        throw new Error('External canonical stream resume requires both resume_after and retained_events');
    }
    if (retained !== undefined && retained.length === 0) {
        throw new Error('External canonical stream resume requires a nonempty retained event prefix');
    }

    let accumulator =
        retained === undefined
            ? undefined
            : new ConversationStreamAccumulatorRuntime(
                  streamIdentity(retained[0]),
                  CanonicalConversationStreamRuntimeValidators,
                  {
                      retained_events: retained,
                      resume_after: request.resume_after,
                  },
              );
    let cursor = request.resume_after;
    let activeStreamId = accumulator?.identity.stream_id;
    let runId: string | undefined;
    let terminal: CanonicalInteractionStreamTerminalEvent | undefined;
    let ingestion: ExperimentalCanonicalInitialIngestionAccepted | undefined;
    let reconnects = 0;
    const maxReconnects = reconnectLimit(options.max_reconnects);
    const notifyEnvelope = (envelope: ExperimentalCanonicalInteractionStreamEnvelope): void => {
        try {
            options.on_envelope?.(envelope);
        } catch (cause) {
            throw new CanonicalInteractionStreamConsumerError('Canonical interaction stream consumer failed', {
                cause,
            });
        }
    };

    while (!terminal && !ingestion) {
        let controlSeen = false;
        let connectionStreamId: string | undefined;
        let acceptedRecovery = false;
        const wireRequest =
            cursor === undefined ? { ...request, resume_after: undefined } : { ...request, resume_after: cursor };

        try {
            await transport.connect(wireRequest, (input) => {
                try {
                    const envelope = parseExperimentalCanonicalInteractionStreamEnvelope(input);
                    if (envelope.type === 'ingestion_accepted') {
                        if (
                            !('kind' in request) ||
                            request.kind !== 'initial_agent' ||
                            envelope.operation_id !== request.operation_id ||
                            controlSeen ||
                            accumulator ||
                            cursor ||
                            terminal ||
                            ingestion ||
                            (runId !== undefined && envelope.run_id !== runId)
                        )
                            throw new Error('Initial ingestion ACK conflicts with the request or model stream');
                        ingestion = structuredClone(envelope);
                        runId = envelope.run_id;
                        notifyEnvelope(envelope);
                        return;
                    }
                    if (ingestion) throw new Error('Initial ingestion ACK cannot be followed by model events');
                    if (runId !== undefined && envelope.run_id !== runId) {
                        throw new Error('Canonical interaction stream changed run identity');
                    }
                    runId ??= envelope.run_id;

                    if (envelope.type !== 'conversation_event') {
                        if (controlSeen) {
                            throw new Error('Canonical interaction stream emitted more than one open envelope');
                        }
                        controlSeen = true;
                        connectionStreamId = envelope.stream_id;
                        if (envelope.operation_id !== request.operation_id) {
                            throw new Error('Canonical interaction stream changed operation identity');
                        }
                        if (envelope.type === 'stream_opened') {
                            if (cursor !== undefined)
                                throw new Error('Canonical stream resume restarted without a cursor');
                            if (activeStreamId !== undefined && activeStreamId !== envelope.stream_id) {
                                throw new Error('Canonical stream reconnect changed stream identity');
                            }
                            activeStreamId = envelope.stream_id;
                        } else if (envelope.type === 'stream_resumed') {
                            if (cursor === undefined || !sameCursor(envelope.resumed_after, cursor)) {
                                throw new Error('Canonical stream resumed from a different cursor');
                            }
                            if (envelope.stream_id !== cursor.stream_id) {
                                throw new Error('Canonical stream resume changed stream identity');
                            }
                            activeStreamId = envelope.stream_id;
                        } else {
                            const replaced = activeStreamId ?? cursor?.stream_id;
                            if (replaced === undefined || envelope.replaces_stream_id !== replaced) {
                                throw new Error('Canonical accepted recovery replaced an unknown stream');
                            }
                            if (envelope.stream_id === envelope.replaces_stream_id) {
                                throw new Error('Canonical accepted recovery did not create a new stream');
                            }
                            accumulator = undefined;
                            cursor = undefined;
                            activeStreamId = envelope.stream_id;
                            acceptedRecovery = true;
                        }
                        notifyEnvelope(envelope);
                        return;
                    }

                    if (!controlSeen || connectionStreamId === undefined) {
                        throw new Error('Canonical interaction event precedes its stream open envelope');
                    }
                    if (envelope.event.stream_id !== connectionStreamId) {
                        throw new Error('Canonical interaction event has the wrong delivery stream identity');
                    }
                    assertHostStatus(envelope);
                    if (
                        acceptedRecovery &&
                        (envelope.event.type !== 'response_accepted' || envelope.event.origin !== 'accepted_recovery')
                    ) {
                        throw new Error(
                            'Canonical accepted recovery must contain exactly one recovered accepted event',
                        );
                    }
                    accumulator ??= new ConversationStreamAccumulatorRuntime(
                        streamIdentity(envelope.event),
                        CanonicalConversationStreamRuntimeValidators,
                    );
                    const appendResult = accumulator.append(envelope.event);
                    const appended = appendResult.event;
                    if (appendResult.applied) cursor = conversationStreamCursor(appended);
                    activeStreamId = appended.stream_id;
                    if (appended.type === 'response_accepted' || appended.type === 'stream_terminated') {
                        terminal = appended;
                    }
                    if (appendResult.applied) notifyEnvelope(envelope);
                } catch (cause) {
                    if (
                        cause instanceof CanonicalInteractionStreamProtocolError ||
                        cause instanceof CanonicalInteractionStreamConsumerError
                    ) {
                        throw cause;
                    }
                    throw new CanonicalInteractionStreamProtocolError('Canonical interaction stream protocol failed', {
                        cause,
                    });
                }
            });
        } catch (error) {
            if (
                error instanceof CanonicalInteractionStreamProtocolError ||
                error instanceof CanonicalInteractionStreamConsumerError
            ) {
                throw error;
            }
            if (terminal || ingestion) break;
            if (error instanceof Error && error.name === 'AbortError') throw error;
            if (options.signal?.aborted) throw error;
            const status =
                error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
                    ? error.status
                    : undefined;
            if (status !== undefined && status !== 0) throw error;
            if (reconnects >= maxReconnects) throw error;
            reconnects += 1;
            continue;
        }

        if (terminal || ingestion) break;
        if (reconnects >= maxReconnects) {
            throw new Error('Canonical interaction stream ended before a terminal event');
        }
        reconnects += 1;
    }

    if (ingestion) return { run_id: ingestion.run_id, operation_id: ingestion.operation_id, terminal_event: ingestion };
    if (!terminal || !runId || !accumulator || !cursor) {
        throw new Error('Canonical interaction stream terminal state is incomplete');
    }
    return {
        run_id: runId,
        operation_id: request.operation_id,
        stream_id: accumulator.identity.stream_id,
        terminal_event: terminal,
        cursor,
        retained_events: accumulator.retained_events,
    };
}
