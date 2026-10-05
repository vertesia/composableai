import type {
    ConversationStreamCursor,
    ConversationStreamEvent,
    ConversationStreamIdentity,
} from '@llumiverse/conversation';
import {
    CONVERSATION_STREAM_MAX_EVENT_BYTES,
    type ConversationStreamRuntimeValidators,
    canonicalJsonContentString,
    preflightJsonInput,
} from '@llumiverse/conversation/streaming-runtime';
import type { ExperimentalCanonicalInteractionStreamEnvelope } from '../canonical-interaction-stream.js';
import type {
    ExperimentalAgentConversationSourceDescriptor,
    ExperimentalAgentConversationStreamEnvelope,
    ExperimentalAgentConversationTranscriptPage,
    ExperimentalAgentDocumentEditingAction,
    ExperimentalAgentEditingResource,
    ExperimentalAgentRunControlEvent,
    ExperimentalAgentRunControlNotification,
    ExperimentalAgentRunStreamEnvelope,
    ExperimentalAgentRunUpdatesResponse,
    ExperimentalAgentUserInputMetadata,
} from '../store/agent-run.js';
import validateCanonicalStreamWireValue from './canonical-stream-validator.generated.js';

/** Fixed host wrapper budget above the canonical event's independently enforced byte limit. */
export const EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES = CONVERSATION_STREAM_MAX_EVENT_BYTES + 1_024;

interface CanonicalStreamWireValues {
    ConversationStreamIdentity: ConversationStreamIdentity;
    ConversationStreamCursor: ConversationStreamCursor;
    ConversationStreamEvent: ConversationStreamEvent;
    ExperimentalCanonicalInteractionStreamEnvelope: ExperimentalCanonicalInteractionStreamEnvelope;
    ExperimentalAgentConversationStreamEnvelope: ExperimentalAgentConversationStreamEnvelope;
    ExperimentalAgentEditingResource: ExperimentalAgentEditingResource;
    ExperimentalAgentDocumentEditingAction: ExperimentalAgentDocumentEditingAction;
    ExperimentalAgentUserInputMetadata: ExperimentalAgentUserInputMetadata;
    ExperimentalAgentRunControlEvent: ExperimentalAgentRunControlEvent;
    ExperimentalAgentRunStreamEnvelope: ExperimentalAgentRunStreamEnvelope;
    ExperimentalAgentRunUpdatesResponse: ExperimentalAgentRunUpdatesResponse;
    ExperimentalAgentConversationTranscriptPage: ExperimentalAgentConversationTranscriptPage;
    ExperimentalAgentConversationSourceDescriptor: ExperimentalAgentConversationSourceDescriptor;
}

function parseCanonicalStreamWireValue<K extends keyof CanonicalStreamWireValues>(
    kind: K,
    input: unknown,
): CanonicalStreamWireValues[K] {
    // Transcript projection uses the canonical JSON defaults, including its larger bounded snapshot budget.
    // Stream wire values retain the smaller per-event limit.
    const preflight =
        kind === 'ExperimentalAgentConversationTranscriptPage' ||
        kind === 'ExperimentalAgentRunUpdatesResponse' ||
        kind === 'ExperimentalAgentDocumentEditingAction' ||
        kind === 'ExperimentalAgentUserInputMetadata'
            ? preflightJsonInput(input)
            : preflightJsonInput(input, {
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

export function parseExperimentalAgentRunStreamEnvelope(input: unknown): ExperimentalAgentRunStreamEnvelope {
    const envelope = parseCanonicalStreamWireValue('ExperimentalAgentRunStreamEnvelope', input);
    if (envelope.type !== 'run_status' && envelope.type !== 'run_control')
        parseExperimentalAgentConversationStreamEnvelope(envelope);
    return envelope;
}

export function parseExperimentalAgentRunControlEvent(input: unknown): ExperimentalAgentRunControlEvent {
    return parseCanonicalStreamWireValue('ExperimentalAgentRunControlEvent', input);
}

export function parseExperimentalAgentRunUpdatesResponse(input: unknown): ExperimentalAgentRunUpdatesResponse {
    const response = parseCanonicalStreamWireValue('ExperimentalAgentRunUpdatesResponse', input);
    if (
        response.run.agent_run_id !== response.source.agent_run_id ||
        response.run.scope !== response.source.scope ||
        response.run.workstream_id !== response.source.workstream_id
    ) {
        throw new TypeError('Canonical run updates changed their authorized source route');
    }
    if (
        response.controls.some(
            (control) =>
                control.agent_run_id !== response.run.agent_run_id ||
                control.scope !== response.run.scope ||
                control.workstream_id !== response.run.workstream_id,
        )
    ) {
        throw new TypeError('Canonical run control changed its authorized source route');
    }
    const ids = response.controls.map((control) => control.control.event_id);
    if (new Set(ids).size !== ids.length) throw new TypeError('Canonical run updates repeat a control identity');
    let prior = 0;
    for (const control of response.controls) {
        if (control.timestamp <= prior) throw new TypeError('Canonical run updates changed control delivery order');
        prior = control.timestamp;
    }
    if (response.controls.length && response.control_page.after !== prior)
        throw new TypeError('Canonical run updates changed their control page cursor');

    return response;
}

export function parseExperimentalAgentConversationTranscriptPage(
    input: unknown,
): ExperimentalAgentConversationTranscriptPage {
    const page = parseCanonicalStreamWireValue('ExperimentalAgentConversationTranscriptPage', input);
    if (
        page.fragment.source.conversation_id !== page.snapshot.conversation_id ||
        page.fragment.source.revision !== page.snapshot.revision
    ) {
        throw new TypeError('Agent conversation transcript source does not match its pinned snapshot');
    }
    return page;
}

export function parseExperimentalAgentConversationSourceDescriptor(
    input: unknown,
): ExperimentalAgentConversationSourceDescriptor {
    return parseCanonicalStreamWireValue('ExperimentalAgentConversationSourceDescriptor', input);
}

export const CanonicalConversationStreamRuntimeValidators: ConversationStreamRuntimeValidators = Object.freeze({
    identity: parseConversationStreamIdentity,
    cursor: parseConversationStreamCursor,
    event: parseConversationStreamEvent,
});

/** Delivery retries may allocate another timestamp; the exact route and control JSON are immutable. */
export function experimentalAgentRunControlIdentity(notification: ExperimentalAgentRunControlNotification): string {
    const { timestamp: _deliveryTimestamp, ...semantic } = notification;
    return canonicalJsonContentString(semantic);
}

export { canonicalJsonContentString };

export function parseExperimentalAgentEditingResource(input: unknown): ExperimentalAgentEditingResource {
    return parseCanonicalStreamWireValue('ExperimentalAgentEditingResource', input);
}

export function parseExperimentalAgentDocumentEditingAction(input: unknown): ExperimentalAgentDocumentEditingAction {
    return parseCanonicalStreamWireValue('ExperimentalAgentDocumentEditingAction', input);
}

export function parseExperimentalAgentUserInputMetadata(input: unknown): ExperimentalAgentUserInputMetadata {
    return parseCanonicalStreamWireValue('ExperimentalAgentUserInputMetadata', input);
}
