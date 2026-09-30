import { conversationOutputReceiptsEqual } from '@llumiverse/conversation/output-runtime';
import { ConversationStreamAccumulatorRuntime } from '@llumiverse/conversation/streaming-runtime';
import type {
    CanonicalConversationHeadScope,
    ConversationStreamEvent,
    ConversationStreamIdentity,
    ExperimentalAgentConversationAcceptedOutput,
    ExperimentalAgentConversationEvent,
    ExperimentalAgentConversationPreviewUnavailable,
    ExperimentalAgentConversationStreamEnvelope,
} from '@vertesia/common';
import {
    CanonicalConversationStreamRuntimeValidators,
    EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES,
    parseExperimentalAgentConversationStreamEnvelope,
} from '@vertesia/common/canonical-stream-runtime';
import type { CanonicalInteractionOutput } from './CanonicalInteractionOutput.js';

const MAX_QUEUED_ENVELOPES = 32;
const MAX_QUEUED_BYTES = EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES * 2;

export interface AgentConversationStreamSessionOptions {
    agent_run_id: string;
    scope?: CanonicalConversationHeadScope;
    workstream_id?: string;
    max_reconnects?: number;
    reconnect_delay_ms?: number;
    signal?: AbortSignal;
    on_update: (update: AgentConversationStreamUpdate) => void | Promise<void>;
}

export type AgentConversationStreamUpdate =
    | ExperimentalAgentConversationPreviewUnavailable
    | ExperimentalAgentConversationEvent
    | {
          type: 'accepted_output';
          envelope: ExperimentalAgentConversationAcceptedOutput;
          output: CanonicalInteractionOutput<unknown>;
      };

export interface AgentConversationStreamTransport {
    connect(onEnvelope: (envelope: unknown) => void, signal: AbortSignal): Promise<void>;
    retrieveAcceptedOutput(
        envelope: ExperimentalAgentConversationAcceptedOutput,
        signal: AbortSignal,
    ): Promise<CanonicalInteractionOutput<unknown>>;
}

export class AgentConversationStreamProtocolError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'AgentConversationStreamProtocolError';
    }
}

export class AgentConversationStreamConsumerError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'AgentConversationStreamConsumerError';
    }
}

export class AgentConversationStreamDisconnectedError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'AgentConversationStreamDisconnectedError';
    }
}

interface QueuedEnvelope {
    envelope: ExperimentalAgentConversationStreamEnvelope;
    bytes: number;
}

class BoundedEnvelopeQueue {
    private readonly items: QueuedEnvelope[] = [];
    private readonly waiters: Array<(item: QueuedEnvelope | undefined) => void> = [];
    private queuedBytes = 0;
    private closed = false;

    push(input: unknown): void {
        if (this.closed)
            throw new AgentConversationStreamProtocolError('Agent conversation stream emitted after close');
        let parsed: ExperimentalAgentConversationStreamEnvelope;
        try {
            parsed = parseExperimentalAgentConversationStreamEnvelope(input);
        } catch (cause) {
            throw new AgentConversationStreamProtocolError('Agent conversation stream emitted an invalid envelope', {
                cause,
            });
        }
        // The runtime parser validates in place. Own the queued value so a custom transport cannot mutate it
        // after enqueue and bypass the validated byte/schema boundary while a prior callback is pending.
        const envelope = structuredClone(parsed);
        const bytes = new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
        if (bytes > EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES) {
            throw new AgentConversationStreamProtocolError('Agent conversation stream envelope exceeds its byte limit');
        }
        const waiter = this.waiters.shift();
        if (waiter) {
            waiter({ envelope, bytes });
            return;
        }
        if (this.items.length >= MAX_QUEUED_ENVELOPES || this.queuedBytes + bytes > MAX_QUEUED_BYTES) {
            throw new AgentConversationStreamProtocolError('Agent conversation stream consumer queue overflowed');
        }
        this.items.push({ envelope, bytes });
        this.queuedBytes += bytes;
    }

    async next(): Promise<QueuedEnvelope | undefined> {
        const item = this.items.shift();
        if (item) {
            this.queuedBytes -= item.bytes;
            return item;
        }
        if (this.closed) return undefined;
        return new Promise((resolve) => this.waiters.push(resolve));
    }

    close(): void {
        if (this.closed) return;
        this.closed = true;
        for (const waiter of this.waiters.splice(0)) waiter(undefined);
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

function reconnectLimit(value: number | undefined): number {
    const limit = value ?? 3;
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 10) {
        throw new RangeError('max_reconnects must be a safe integer between 0 and 10');
    }
    return limit;
}

function reconnectDelay(value: number | undefined): number {
    const delay = value ?? 250;
    if (!Number.isSafeInteger(delay) || delay < 0 || delay > 30_000) {
        throw new RangeError('reconnect_delay_ms must be a safe integer between 0 and 30000');
    }
    return delay;
}

function waitForReconnect(delay: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    return new Promise((resolve, reject) => {
        const finish = () => {
            signal?.removeEventListener('abort', abort);
            resolve();
        };
        const timer = setTimeout(finish, delay);
        const abort = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            reject(signal?.reason);
        };
        signal?.addEventListener('abort', abort, { once: true });
    });
}

/**
 * Consumes one live-only agent conversation stream. Every connection must begin with an explicit preview reset;
 * durable accepted output is then resolved through the exact receipt endpoint rather than reconstructed from drafts.
 */
export async function consumeAgentConversationStream(
    transport: AgentConversationStreamTransport,
    options: AgentConversationStreamSessionOptions,
): Promise<void> {
    let expectedScope = options.scope;
    let scopePinned = options.scope !== undefined;
    let expectedWorkstreamId = options.workstream_id;
    let workstreamPinned = options.workstream_id !== undefined;
    const maxReconnects = reconnectLimit(options.max_reconnects);
    const reconnectDelayMs = reconnectDelay(options.reconnect_delay_ms);
    let reconnects = 0;
    let lastAcceptedReceipt: ExperimentalAgentConversationAcceptedOutput['receipt'] | undefined;

    while (!options.signal?.aborted) {
        const controller = new AbortController();
        const abortFromCaller = () => controller.abort(options.signal?.reason);
        options.signal?.addEventListener('abort', abortFromCaller, { once: true });
        const queue = new BoundedEnvelopeQueue();
        let firstEnvelope = true;
        let accumulator: ConversationStreamAccumulatorRuntime | undefined;
        let activeExecutionRunId: string | undefined;
        let processingFailure: unknown;
        let connectionActive = true;

        const publish = async (update: AgentConversationStreamUpdate): Promise<void> => {
            if (!connectionActive) return;
            try {
                await options.on_update(update);
            } catch (cause) {
                throw new AgentConversationStreamConsumerError('Agent conversation stream consumer failed', { cause });
            }
        };
        const processEnvelopes = async (): Promise<void> => {
            while (true) {
                const queued = await queue.next();
                if (!queued) return;
                const envelope = queued.envelope;
                if (envelope.agent_run_id !== options.agent_run_id) {
                    throw new AgentConversationStreamProtocolError('Agent conversation stream changed run');
                }
                if (!scopePinned) {
                    expectedScope = envelope.scope;
                    scopePinned = true;
                } else if (envelope.scope !== expectedScope) {
                    throw new AgentConversationStreamProtocolError('Agent conversation stream changed scope');
                }
                if (!workstreamPinned) {
                    expectedWorkstreamId = envelope.workstream_id;
                    workstreamPinned = true;
                } else if (envelope.workstream_id !== expectedWorkstreamId) {
                    throw new AgentConversationStreamProtocolError('Agent conversation stream changed workstream');
                }
                if (firstEnvelope) {
                    firstEnvelope = false;
                    if (envelope.type !== 'preview_unavailable') {
                        throw new AgentConversationStreamProtocolError(
                            'Agent conversation stream connection did not begin by clearing provisional preview',
                        );
                    }
                }

                if (envelope.type === 'preview_unavailable') {
                    accumulator = undefined;
                    activeExecutionRunId = undefined;
                    await publish(envelope);
                    continue;
                }
                if (envelope.type === 'accepted_output') {
                    if (!accumulator || accumulator.identity.response_operation_id === envelope.receipt.id) {
                        accumulator = undefined;
                        activeExecutionRunId = undefined;
                    }
                    if (lastAcceptedReceipt && conversationOutputReceiptsEqual(lastAcceptedReceipt, envelope.receipt)) {
                        continue;
                    }
                    const output = await transport.retrieveAcceptedOutput(envelope, controller.signal);
                    if (!connectionActive) return;
                    if (!conversationOutputReceiptsEqual(output.fragment.receipt, envelope.receipt)) {
                        throw new AgentConversationStreamProtocolError(
                            'Agent conversation stream accepted output does not match its announced receipt',
                        );
                    }
                    lastAcceptedReceipt = structuredClone(envelope.receipt);
                    await publish({ type: 'accepted_output', envelope, output });
                    continue;
                }

                const event = envelope.event;
                if (event.type === 'stream_terminated') {
                    if (accumulator?.identity.stream_id === event.stream_id) {
                        accumulator.append(event);
                        accumulator = undefined;
                        activeExecutionRunId = undefined;
                    }
                    await publish(envelope);
                    continue;
                }
                if (accumulator && event.type === 'draft_started' && event.sequence === 0) {
                    accumulator = undefined;
                    activeExecutionRunId = undefined;
                    await publish({
                        api_version: envelope.api_version,
                        agent_run_id: envelope.agent_run_id,
                        scope: envelope.scope,
                        ...(envelope.workstream_id === undefined ? {} : { workstream_id: envelope.workstream_id }),
                        type: 'preview_unavailable',
                        reason: 'sequence_gap',
                    });
                }
                if (!accumulator) {
                    if (event.type !== 'draft_started' || event.sequence !== 0) {
                        await publish({
                            api_version: envelope.api_version,
                            agent_run_id: envelope.agent_run_id,
                            scope: envelope.scope,
                            ...(envelope.workstream_id === undefined ? {} : { workstream_id: envelope.workstream_id }),
                            type: 'preview_unavailable',
                            reason: 'sequence_gap',
                        });
                        throw new AgentConversationStreamProtocolError(
                            'Agent conversation stream cannot consume a draft without its exact prefix',
                        );
                    }
                    accumulator = new ConversationStreamAccumulatorRuntime(
                        streamIdentity(event),
                        CanonicalConversationStreamRuntimeValidators,
                    );
                    activeExecutionRunId = envelope.execution_run_id;
                } else if (activeExecutionRunId !== envelope.execution_run_id) {
                    accumulator = undefined;
                    activeExecutionRunId = undefined;
                    await publish({
                        api_version: envelope.api_version,
                        agent_run_id: envelope.agent_run_id,
                        scope: envelope.scope,
                        ...(envelope.workstream_id === undefined ? {} : { workstream_id: envelope.workstream_id }),
                        type: 'preview_unavailable',
                        reason: 'sequence_gap',
                    });
                    throw new AgentConversationStreamProtocolError(
                        'Agent conversation stream changed execution within one provisional draft',
                    );
                }
                try {
                    accumulator.append(event);
                } catch (cause) {
                    accumulator = undefined;
                    activeExecutionRunId = undefined;
                    await publish({
                        api_version: envelope.api_version,
                        agent_run_id: envelope.agent_run_id,
                        scope: envelope.scope,
                        ...(envelope.workstream_id === undefined ? {} : { workstream_id: envelope.workstream_id }),
                        type: 'preview_unavailable',
                        reason: 'sequence_gap',
                    });
                    throw new AgentConversationStreamProtocolError(
                        'Agent conversation stream canonical event sequence is invalid',
                        { cause },
                    );
                }
                await publish(envelope);
            }
        };

        let processingSettled = false;
        const processing = processEnvelopes()
            .catch((cause: unknown) => {
                processingFailure = cause;
                controller.abort(cause);
            })
            .finally(() => {
                processingSettled = true;
            });
        let transportFailure: unknown;
        try {
            const connect = transport.connect((envelope) => queue.push(envelope), controller.signal);
            await new Promise<void>((resolve, reject) => {
                const settled = () => controller.signal.removeEventListener('abort', aborted);
                const aborted = () => {
                    settled();
                    reject(controller.signal.reason);
                };
                controller.signal.addEventListener('abort', aborted, { once: true });
                connect.then(
                    () => {
                        settled();
                        resolve();
                    },
                    (cause: unknown) => {
                        settled();
                        reject(cause);
                    },
                );
                if (controller.signal.aborted) aborted();
            });
        } catch (cause) {
            transportFailure = cause;
        } finally {
            queue.close();
            if (!processingSettled && !controller.signal.aborted) {
                await Promise.race([processing, new Promise<void>((resolve) => setTimeout(resolve, 0))]);
            }
            if (!processingSettled && !controller.signal.aborted) controller.abort(transportFailure);
            if (!processingSettled) {
                await Promise.race([
                    processing,
                    new Promise<void>((resolve) => {
                        if (controller.signal.aborted) resolve();
                        else controller.signal.addEventListener('abort', () => resolve(), { once: true });
                    }),
                ]);
            }
            connectionActive = false;
            options.signal?.removeEventListener('abort', abortFromCaller);
        }

        if (processingFailure instanceof AgentConversationStreamProtocolError) throw processingFailure;
        if (processingFailure instanceof AgentConversationStreamConsumerError) throw processingFailure;
        if (options.signal?.aborted) return;
        if (reconnects >= maxReconnects) {
            throw new AgentConversationStreamDisconnectedError('Agent conversation stream reconnect limit exceeded', {
                cause: processingFailure ?? transportFailure,
            });
        }
        reconnects += 1;
        await waitForReconnect(reconnectDelayMs, options.signal);
    }
}
