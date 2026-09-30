import type {
    ConversationStreamCursor,
    ConversationStreamEvent,
    ConversationStreamIdentity,
} from '@llumiverse/conversation';
import {
    CONVERSATION_STREAM_MAX_EVENT_BYTES,
    type ConversationStreamRuntimeValidators,
    preflightJsonInput,
} from '@llumiverse/conversation/streaming-runtime';
import type { ExperimentalCanonicalInteractionStreamEnvelope } from '../canonical-interaction-stream.js';
import type { ExperimentalAgentConversationStreamEnvelope } from '../store/agent-run.js';
import validateCanonicalStreamWireValue from './canonical-stream-validator.generated.js';

/** Fixed host wrapper budget above the canonical event's independently enforced byte limit. */
export const EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES = CONVERSATION_STREAM_MAX_EVENT_BYTES + 1_024;

interface CanonicalStreamWireValues {
    ConversationStreamIdentity: ConversationStreamIdentity;
    ConversationStreamCursor: ConversationStreamCursor;
    ConversationStreamEvent: ConversationStreamEvent;
    ExperimentalCanonicalInteractionStreamEnvelope: ExperimentalCanonicalInteractionStreamEnvelope;
    ExperimentalAgentConversationStreamEnvelope: ExperimentalAgentConversationStreamEnvelope;
}

function parseCanonicalStreamWireValue<K extends keyof CanonicalStreamWireValues>(
    kind: K,
    input: unknown,
): CanonicalStreamWireValues[K] {
    const preflight = preflightJsonInput(input, {
        max_depth: 64,
        max_nodes: 100_000,
        max_bytes: EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES,
        max_string_bytes: EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES,
        max_array_length: 100_000,
        max_object_properties: 1_024,
    });
    if (!preflight.success) throw new TypeError(`${kind} failed bounded JSON preflight`);
    if (!validateCanonicalStreamWireValue({ kind, value: input })) {
        throw new TypeError(`${kind} failed canonical API schema validation`);
    }
    return input as CanonicalStreamWireValues[K];
}

export function parseConversationStreamIdentity(input: unknown): ConversationStreamIdentity {
    return parseCanonicalStreamWireValue('ConversationStreamIdentity', input);
}

export function parseConversationStreamCursor(input: unknown): ConversationStreamCursor {
    return parseCanonicalStreamWireValue('ConversationStreamCursor', input);
}

export function parseConversationStreamEvent(input: unknown): ConversationStreamEvent {
    return parseCanonicalStreamWireValue('ConversationStreamEvent', input);
}

export function parseExperimentalCanonicalInteractionStreamEnvelope(
    input: unknown,
): ExperimentalCanonicalInteractionStreamEnvelope {
    const envelope = parseCanonicalStreamWireValue('ExperimentalCanonicalInteractionStreamEnvelope', input);
    if (envelope.type === 'stream_resumed' && envelope.resumed_after.stream_id !== envelope.stream_id) {
        throw new TypeError('Canonical stream resumed cursor has the wrong stream ID');
    }
    if (envelope.type === 'accepted_recovery_opened' && envelope.replaces_stream_id === envelope.stream_id) {
        throw new TypeError('Canonical accepted recovery must replace a different stream');
    }
    return envelope;
}

export function parseExperimentalAgentConversationStreamEnvelope(
    input: unknown,
): ExperimentalAgentConversationStreamEnvelope {
    const envelope = parseCanonicalStreamWireValue('ExperimentalAgentConversationStreamEnvelope', input);
    if (envelope.type === 'conversation_event' && envelope.event.type === 'response_accepted') {
        throw new TypeError('Agent conversation stream accepted output must use a durable reference envelope');
    }
    if (
        envelope.type === 'accepted_output' &&
        (envelope.source.conversation_id !== envelope.receipt.conversation_id ||
            envelope.source.revision !== envelope.receipt.result_revision)
    ) {
        throw new TypeError('Agent conversation stream accepted output source does not match its receipt');
    }
    return envelope;
}

export const CanonicalConversationStreamRuntimeValidators: ConversationStreamRuntimeValidators = Object.freeze({
    identity: parseConversationStreamIdentity,
    cursor: parseConversationStreamCursor,
    event: parseConversationStreamEvent,
});
