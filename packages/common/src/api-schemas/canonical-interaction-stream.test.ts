import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
    ExperimentalCanonicalAgentAcceptanceTargetSchema,
    ExperimentalCanonicalInteractionAcceptedRecoveryOpenedSchema,
    ExperimentalCanonicalInteractionConversationEventSchema,
    ExperimentalCanonicalInteractionStreamEnvelopeSchema,
    ExperimentalCanonicalInteractionStreamRequestSchema,
    ExperimentalCanonicalInteractionStreamResumedSchema,
} from './canonical-interaction-stream.js';
import { ApiSchemaComponents } from './registry.js';

const API_VERSION = '=20260930';
const STREAM_ID = 'stream:contract';

function streamEventIdentity(sequence: number) {
    return {
        format: 'llumiverse.conversation' as const,
        schema_version: 0 as const,
        experimental_revision: '2026-09-30.adoption.1' as const,
        stream_id: STREAM_ID,
        request_id: 'request:contract',
        attempt_id: 'attempt:contract',
        response_operation_id: 'operation:response',
        generation_id: 'generation:contract',
        draft_turn_id: 'turn:draft',
        event_id: `event:${sequence}`,
        sequence,
    };
}

function draftStarted(sequence = 0) {
    return {
        ...streamEventIdentity(sequence),
        type: 'draft_started' as const,
        origin: 'live_transport' as const,
    };
}

function responseAccepted(sequence = 1) {
    return {
        ...streamEventIdentity(sequence),
        type: 'response_accepted' as const,
        origin: 'live_transport' as const,
        conversation: { conversation_id: 'conversation:contract', revision: 3 },
        operation_receipt_id: 'receipt:operation',
        committed_turn_id: 'turn:accepted',
        turn_status: 'completed' as const,
        generation_status: 'completed' as const,
        committed_block_ids: ['block:accepted'],
        accepted_asset_ids: [],
        reconciliations: [],
    };
}

function streamTerminated(sequence = 2) {
    return {
        ...streamEventIdentity(sequence),
        type: 'stream_terminated' as const,
        outcome: 'failed' as const,
        diagnostic: { code: 'provider_failure', message: 'Provider stream failed', retryable: true },
    };
}

function namedRequest(initialState: Record<string, unknown> = { type: 'new' }) {
    return {
        interaction: 'stream-contract',
        initial_state: initialState,
        retention: 'DEBUG' as const,
        return_policy: { history: 'reference' as const },
    };
}

function conversationEnvelope(event: unknown, hostStatus: string) {
    return {
        api_version: API_VERSION,
        type: 'conversation_event',
        run_id: '507f1f77bcf86cd799439011',
        host_status: hostStatus,
        event,
    };
}

function ajvComponent(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    return ajv.compile({
        components: { schemas: ApiSchemaComponents },
        $ref: `#/components/schemas/${name}`,
    });
}

describe('experimental canonical interaction stream schemas', () => {
    it('binds a retained-reference operation to the outer stream operation', () => {
        const reference = {
            type: 'reference',
            reference: {
                run_id: '507f1f77bcf86cd799439012',
                conversation: { conversation_id: 'conversation:contract', revision: 2 },
            },
            operation_id: 'operation:stream',
        };
        expect(
            ExperimentalCanonicalInteractionStreamRequestSchema.parse({
                operation_id: 'operation:stream',
                request: namedRequest(reference),
                resume_after: { stream_id: STREAM_ID, event_id: 'event:4', sequence: 4 },
            }),
        ).toMatchObject({ operation_id: 'operation:stream', resume_after: { sequence: 4 } });

        expect(
            ExperimentalCanonicalInteractionStreamRequestSchema.safeParse({
                operation_id: 'operation:different',
                request: namedRequest(reference),
            }).success,
        ).toBe(false);
    });

    it('strictly distinguishes root and workstream agent acceptance targets in Zod and JSON Schema', () => {
        const root = {
            version: 1 as const,
            subject_agent_run_id: 'agent:root',
            scope: 'root' as const,
            activity_id: 'activity:start',
        };
        const workstream = {
            ...root,
            subject_agent_run_id: 'agent:child',
            scope: 'workstream:node-1' as const,
            workstream_id: 'node-1',
        };
        const validate = ajvComponent('ExperimentalCanonicalAgentAcceptanceTarget');

        expect(ExperimentalCanonicalAgentAcceptanceTargetSchema.parse(root)).toEqual(root);
        expect(ExperimentalCanonicalAgentAcceptanceTargetSchema.parse(workstream)).toEqual(workstream);
        expect(validate(root)).toBe(true);
        expect(validate(workstream)).toBe(true);

        for (const invalid of [
            { ...root, workstream_id: 'main' },
            { ...workstream, workstream_id: undefined },
            { ...workstream, scope: 'workstream:../../other' },
            { ...root, version: 2 },
            { ...root, storage_id: 'caller-selected' },
        ]) {
            expect(ExperimentalCanonicalAgentAcceptanceTargetSchema.safeParse(invalid).success).toBe(false);
            expect(validate(invalid)).toBe(false);
        }

        expect(
            ExperimentalCanonicalInteractionStreamRequestSchema.parse({
                operation_id: 'operation:stream',
                request: namedRequest(),
                agent_acceptance: workstream,
            }).agent_acceptance,
        ).toEqual(workstream);
    });

    it('requires the literal API version on every host envelope', () => {
        const recovery = {
            api_version: API_VERSION,
            type: 'accepted_recovery_opened' as const,
            run_id: '507f1f77bcf86cd799439011',
            operation_id: 'operation:stream',
            stream_id: 'stream:recovery',
            replaces_stream_id: STREAM_ID,
        };
        expect(ExperimentalCanonicalInteractionAcceptedRecoveryOpenedSchema.parse(recovery)).toEqual(recovery);
        expect(
            ExperimentalCanonicalInteractionAcceptedRecoveryOpenedSchema.safeParse({
                ...recovery,
                api_version: '20260930',
            }).success,
        ).toBe(false);
        expect(
            ExperimentalCanonicalInteractionStreamEnvelopeSchema.safeParse({
                ...recovery,
                api_version: '=20260803',
            }).success,
        ).toBe(false);
    });

    it('binds resume cursors to their stream and makes accepted recovery replace a distinct stream', () => {
        const resumed = {
            api_version: API_VERSION,
            type: 'stream_resumed' as const,
            run_id: '507f1f77bcf86cd799439011',
            operation_id: 'operation:stream',
            stream_id: STREAM_ID,
            resumed_after: { stream_id: STREAM_ID, event_id: 'event:4', sequence: 4 },
        };
        expect(ExperimentalCanonicalInteractionStreamResumedSchema.safeParse(resumed).success).toBe(true);
        expect(
            ExperimentalCanonicalInteractionStreamResumedSchema.safeParse({
                ...resumed,
                resumed_after: { ...resumed.resumed_after, stream_id: 'stream:other' },
            }).success,
        ).toBe(false);

        const recovery = {
            api_version: API_VERSION,
            type: 'accepted_recovery_opened' as const,
            run_id: resumed.run_id,
            operation_id: resumed.operation_id,
            stream_id: 'stream:recovery',
            replaces_stream_id: STREAM_ID,
        };
        expect(ExperimentalCanonicalInteractionAcceptedRecoveryOpenedSchema.safeParse(recovery).success).toBe(true);
        expect(
            ExperimentalCanonicalInteractionAcceptedRecoveryOpenedSchema.safeParse({
                ...recovery,
                replaces_stream_id: recovery.stream_id,
            }).success,
        ).toBe(false);
    });

    it.each([
        [draftStarted(), 'provisional'],
        [responseAccepted(), 'accepted'],
        [streamTerminated(), 'terminated'],
    ] as const)('binds $type to host status $hostStatus in Zod', (event, hostStatus) => {
        expect(
            ExperimentalCanonicalInteractionConversationEventSchema.safeParse(conversationEnvelope(event, hostStatus))
                .success,
        ).toBe(true);
        for (const wrong of ['provisional', 'accepted', 'terminated'].filter((candidate) => candidate !== hostStatus)) {
            expect(
                ExperimentalCanonicalInteractionConversationEventSchema.safeParse(conversationEnvelope(event, wrong))
                    .success,
            ).toBe(false);
        }
    });

    it('publishes the same host-status conditions for installed-route AJV validation', () => {
        const validate = ajvComponent('ExperimentalCanonicalInteractionConversationEvent');
        for (const [event, hostStatus] of [
            [draftStarted(), 'provisional'],
            [responseAccepted(), 'accepted'],
            [streamTerminated(), 'terminated'],
        ] as const) {
            expect(validate(conversationEnvelope(event, hostStatus))).toBe(true);
            for (const wrong of ['provisional', 'accepted', 'terminated'].filter(
                (candidate) => candidate !== hostStatus,
            )) {
                expect(validate(conversationEnvelope(event, wrong))).toBe(false);
            }
        }
    });

    it('publishes named branches and a complete exact discriminator mapping', () => {
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionStreamEnvelope).toMatchObject({
            oneOf: [
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionStreamOpened' },
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionStreamResumed' },
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionAcceptedRecoveryOpened' },
                { $ref: '#/components/schemas/ExperimentalCanonicalInteractionConversationEvent' },
            ],
            discriminator: {
                propertyName: 'type',
                mapping: {
                    stream_opened: '#/components/schemas/ExperimentalCanonicalInteractionStreamOpened',
                    stream_resumed: '#/components/schemas/ExperimentalCanonicalInteractionStreamResumed',
                    accepted_recovery_opened:
                        '#/components/schemas/ExperimentalCanonicalInteractionAcceptedRecoveryOpened',
                    conversation_event: '#/components/schemas/ExperimentalCanonicalInteractionConversationEvent',
                },
            },
        });
        expect(ApiSchemaComponents.ExperimentalCanonicalInteractionConversationEvent).toMatchObject({
            allOf: [
                {
                    if: {
                        properties: {
                            event: {
                                type: 'object',
                                properties: { type: { const: 'response_accepted' } },
                                required: ['type'],
                                additionalProperties: true,
                            },
                        },
                        required: ['event'],
                    },
                },
            ],
        });
    });

    it('rejects undeclared envelope and request fields', () => {
        expect(
            ExperimentalCanonicalInteractionStreamRequestSchema.safeParse({
                operation_id: 'operation:stream',
                request: namedRequest(),
                transcript: [],
            }).success,
        ).toBe(false);
        expect(
            ExperimentalCanonicalInteractionConversationEventSchema.safeParse({
                ...conversationEnvelope(draftStarted(), 'provisional'),
                provider_payload: {},
            }).success,
        ).toBe(false);
    });

    it('keeps every public conversation stream dependency registered', () => {
        for (const name of [
            'ConversationStreamIdentity',
            'ConversationStreamCursor',
            'ConversationNativeStreamPathSegment',
            'ConversationNativeStreamPosition',
            'ConversationStreamDraftBlock',
            'ConversationStreamFailureDiagnostic',
            'ConversationStreamReconciliation',
            'ConversationStreamTransformationProof',
            'ConversationStreamResponseMapping',
            'ConversationStreamDecodeEvidence',
            'ConversationStreamEvent',
        ]) {
            expect(ApiSchemaComponents).toHaveProperty(name);
        }
    });
});
