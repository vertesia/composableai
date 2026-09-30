import { readFileSync } from 'node:fs';
import { CONVERSATION_STREAM_MAX_EVENT_BYTES } from '@llumiverse/conversation/streaming-runtime';
import { describe, expect, it } from 'vitest';
import { ExperimentalAgentConversationStreamEnvelopeSchema } from '../api-schemas/agent-runs.js';
import { ExperimentalCanonicalInteractionStreamEnvelopeSchema } from '../api-schemas/canonical-interaction-stream.js';
import {
    EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES,
    parseConversationStreamEvent,
    parseExperimentalAgentConversationStreamEnvelope,
    parseExperimentalCanonicalInteractionStreamEnvelope,
} from './index.js';

const API_VERSION = '=20260930';
const RUN_ID = '507f1f77bcf86cd799439011';
const STREAM_ID = 'stream:runtime';

function event(sequence = 0) {
    return {
        format: 'llumiverse.conversation' as const,
        schema_version: 0 as const,
        experimental_revision: '2026-09-30.adoption.1' as const,
        stream_id: STREAM_ID,
        request_id: 'request:runtime',
        attempt_id: 'attempt:runtime',
        response_operation_id: 'operation:response',
        generation_id: 'generation:runtime',
        draft_turn_id: 'turn:draft',
        event_id: `${STREAM_ID}#${sequence}`,
        sequence,
        type: 'draft_started' as const,
        origin: 'live_transport' as const,
    };
}

const envelopes = [
    {
        api_version: API_VERSION,
        type: 'stream_opened' as const,
        run_id: RUN_ID,
        operation_id: 'operation:runtime',
        stream_id: STREAM_ID,
    },
    {
        api_version: API_VERSION,
        type: 'stream_resumed' as const,
        run_id: RUN_ID,
        operation_id: 'operation:runtime',
        stream_id: STREAM_ID,
        resumed_after: { stream_id: STREAM_ID, event_id: `${STREAM_ID}#0`, sequence: 0 },
    },
    {
        api_version: API_VERSION,
        type: 'accepted_recovery_opened' as const,
        run_id: RUN_ID,
        operation_id: 'operation:runtime',
        stream_id: 'stream:recovery',
        replaces_stream_id: STREAM_ID,
    },
    {
        api_version: API_VERSION,
        type: 'conversation_event' as const,
        run_id: RUN_ID,
        host_status: 'provisional' as const,
        event: event(),
    },
];

describe('canonical stream browser runtime validators', () => {
    it('accepts the same exact envelope variants as the authored schemas', () => {
        for (const envelope of envelopes) {
            expect(ExperimentalCanonicalInteractionStreamEnvelopeSchema.safeParse(envelope).success).toBe(true);
            expect(parseExperimentalCanonicalInteractionStreamEnvelope(envelope)).toBe(envelope);
        }
        expect(parseConversationStreamEvent(event())).toEqual(event());
    });

    it.each([
        { ...envelopes[0], extra: true },
        { ...envelopes[0], type: 'unknown' },
        { ...envelopes[1], resumed_after: { stream_id: 'stream:other', event_id: 'event:0', sequence: 0 } },
        {
            ...envelopes[2],
            stream_id: STREAM_ID,
            replaces_stream_id: STREAM_ID,
        },
        { ...envelopes[3], host_status: 'accepted' },
    ])('rejects invalid exact wire input %#', (input) => {
        expect(() => parseExperimentalCanonicalInteractionStreamEnvelope(input)).toThrow(TypeError);
    });

    it('rejects accessor and oversized input before generated validation', () => {
        let reads = 0;
        const accessor = Object.defineProperty({}, 'type', {
            enumerable: true,
            get() {
                reads += 1;
                return 'stream_opened';
            },
        });
        expect(() => parseExperimentalCanonicalInteractionStreamEnvelope(accessor)).toThrow('bounded JSON preflight');
        expect(reads).toBe(0);
        expect(() =>
            parseExperimentalCanonicalInteractionStreamEnvelope({
                ...envelopes[0],
                operation_id: 'x'.repeat(EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES + 1),
            }),
        ).toThrow('bounded JSON preflight');
    });

    it('reserves enough host-wrapper bytes for a valid near-limit canonical event', () => {
        const { origin: _origin, ...baseEvent } = event();
        const nearLimitEvent = {
            ...baseEvent,
            type: 'draft_text_delta' as const,
            draft_block_id: 'block:near-limit',
            native_position: { protocol: 'test', path: ['parts', 0] },
            text: 'x'.repeat(CONVERSATION_STREAM_MAX_EVENT_BYTES - 1_024),
        };
        const envelope = {
            api_version: API_VERSION,
            type: 'conversation_event' as const,
            run_id: RUN_ID,
            host_status: 'provisional' as const,
            event: nearLimitEvent,
        };

        expect(EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES).toBe(
            CONVERSATION_STREAM_MAX_EVENT_BYTES + 1_024,
        );
        expect(parseConversationStreamEvent(nearLimitEvent)).toBe(nearLimitEvent);
        expect(parseExperimentalCanonicalInteractionStreamEnvelope(envelope)).toBe(envelope);
    });

    it('emits an ESM standalone validator without schema-authoring runtime imports', () => {
        const source = readFileSync(new URL('./canonical-stream-validator.generated.js', import.meta.url), 'utf8');
        expect(source).not.toContain('require(');
        expect(source).not.toContain('zod');
        expect(source).not.toContain('api-schemas');
        expect(source).not.toContain('components.generated');
    });
});

describe('agent conversation stream browser runtime validator', () => {
    const base = {
        api_version: API_VERSION,
        agent_run_id: RUN_ID,
        scope: 'root' as const,
    };
    const receipt = {
        id: 'operation:accepted',
        conversation_id: 'conversation:runtime',
        base_revision: 3,
        result_revision: 4,
        recorded_at: '2026-10-01T00:00:00.000Z',
        accepted_turn_ids: ['turn:accepted'],
        accepted_generation_ids: ['generation:accepted'],
        accepted_asset_ids: [],
    };

    it('accepts live events, preview resets, and exact durable accepted references', () => {
        const values = [
            { ...base, type: 'preview_unavailable' as const, reason: 'live_only' as const },
            {
                ...base,
                type: 'conversation_event' as const,
                execution_run_id: 'execution:runtime',
                event: event(),
            },
            {
                ...base,
                type: 'accepted_output' as const,
                source: { conversation_id: receipt.conversation_id, revision: receipt.result_revision },
                receipt,
            },
        ];
        for (const value of values) {
            expect(ExperimentalAgentConversationStreamEnvelopeSchema.safeParse(value).success).toBe(true);
            expect(parseExperimentalAgentConversationStreamEnvelope(value)).toBe(value);
        }
    });

    it('rejects response acceptance as a provisional event and mismatched accepted references', () => {
        const responseAccepted = {
            ...event(),
            type: 'response_accepted' as const,
            origin: 'live_transport' as const,
            conversation: { conversation_id: receipt.conversation_id, revision: receipt.result_revision },
            operation_receipt_id: receipt.id,
            committed_turn_id: receipt.accepted_turn_ids[0],
            turn_status: 'completed' as const,
            generation_status: 'completed' as const,
            committed_block_ids: ['block:accepted'],
            accepted_asset_ids: [],
            reconciliations: [],
        };
        expect(() =>
            parseExperimentalAgentConversationStreamEnvelope({
                ...base,
                type: 'conversation_event',
                execution_run_id: 'execution:runtime',
                event: responseAccepted,
            }),
        ).toThrow(TypeError);
        expect(() =>
            parseExperimentalAgentConversationStreamEnvelope({
                ...base,
                type: 'accepted_output',
                source: { conversation_id: receipt.conversation_id, revision: receipt.result_revision + 1 },
                receipt,
            }),
        ).toThrow('source does not match');
    });
});
