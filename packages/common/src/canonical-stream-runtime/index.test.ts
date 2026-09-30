import { readFileSync } from 'node:fs';
import { CONVERSATION_STREAM_MAX_EVENT_BYTES } from '@llumiverse/conversation/streaming-runtime';
import { describe, expect, it } from 'vitest';
import { ExperimentalCanonicalInteractionStreamEnvelopeSchema } from '../api-schemas/canonical-interaction-stream.js';
import {
    EXPERIMENTAL_CANONICAL_INTERACTION_STREAM_MAX_ENVELOPE_BYTES,
    parseConversationStreamEvent,
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
