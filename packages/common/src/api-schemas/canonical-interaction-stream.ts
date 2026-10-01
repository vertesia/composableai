import {
    ConversationStreamCursorSchema,
    ConversationStreamEventSchema,
    IdentifierSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE } from '../versions.js';
import { ExperimentalCanonicalNamedInteractionExecutionRequestSchema } from './canonical-interaction-execution.js';

const agentAcceptanceBase = {
    version: z.literal(1),
    subject_agent_run_id: IdentifierSchema,
    activity_id: IdentifierSchema,
};

export const ExperimentalCanonicalAgentAcceptanceTargetSchema = z
    .union([
        z.strictObject({
            ...agentAcceptanceBase,
            scope: z.literal('root'),
        }),
        z.strictObject({
            ...agentAcceptanceBase,
            scope: z.string().regex(/^workstream:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
            workstream_id: IdentifierSchema,
        }),
    ])
    .meta({
        id: 'ExperimentalCanonicalAgentAcceptanceTarget',
        description:
            'Authenticated agent-run target whose scoped durable canonical head must be committed before acceptance is delivered.',
    });

export const ExperimentalCanonicalInteractionStreamRequestSchema = z
    .strictObject({
        operation_id: IdentifierSchema,
        request: ExperimentalCanonicalNamedInteractionExecutionRequestSchema,
        resume_after: ConversationStreamCursorSchema.optional(),
        agent_acceptance: ExperimentalCanonicalAgentAcceptanceTargetSchema.optional(),
    })
    .superRefine((value, context) => {
        if (
            value.request.initial_state.type === 'reference' &&
            value.request.initial_state.operation_id !== value.operation_id
        ) {
            context.addIssue({
                code: 'custom',
                message: 'The retained-reference operation must match the stream operation',
                path: ['request', 'initial_state', 'operation_id'],
            });
        }
    })
    .meta({ id: 'ExperimentalCanonicalInteractionStreamRequest' });

const streamControlShape = {
    api_version: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
    run_id: z.string().min(1),
    operation_id: IdentifierSchema,
    stream_id: IdentifierSchema,
};

export const ExperimentalCanonicalInteractionStreamOpenedSchema = z
    .strictObject({
        ...streamControlShape,
        type: z.literal('stream_opened'),
    })
    .meta({ id: 'ExperimentalCanonicalInteractionStreamOpened' });

export const ExperimentalCanonicalInteractionStreamResumedSchema = z
    .strictObject({
        ...streamControlShape,
        type: z.literal('stream_resumed'),
        resumed_after: ConversationStreamCursorSchema,
    })
    .superRefine((value, context) => {
        if (value.resumed_after.stream_id !== value.stream_id) {
            context.addIssue({
                code: 'custom',
                message: 'The resumed cursor must belong to the resumed delivery stream',
                path: ['resumed_after', 'stream_id'],
            });
        }
    })
    .meta({ id: 'ExperimentalCanonicalInteractionStreamResumed' });

export const ExperimentalCanonicalInteractionAcceptedRecoveryOpenedSchema = z
    .strictObject({
        ...streamControlShape,
        type: z.literal('accepted_recovery_opened'),
        replaces_stream_id: IdentifierSchema,
    })
    .superRefine((value, context) => {
        if (value.replaces_stream_id === value.stream_id) {
            context.addIssue({
                code: 'custom',
                message: 'Accepted recovery must replace a different delivery stream',
                path: ['replaces_stream_id'],
            });
        }
    })
    .meta({ id: 'ExperimentalCanonicalInteractionAcceptedRecoveryOpened' });

const hostStatusJsonSchema = {
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
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema's conditional keyword is literally `then`.
            then: {
                properties: { host_status: { const: 'accepted' } },
                required: ['host_status'],
            },
            else: {
                if: {
                    properties: {
                        event: {
                            type: 'object',
                            properties: { type: { const: 'stream_terminated' } },
                            required: ['type'],
                            additionalProperties: true,
                        },
                    },
                    required: ['event'],
                },
                // biome-ignore lint/suspicious/noThenProperty: JSON Schema's conditional keyword is literally `then`.
                then: {
                    properties: { host_status: { const: 'terminated' } },
                    required: ['host_status'],
                },
                else: {
                    properties: { host_status: { const: 'provisional' } },
                    required: ['host_status'],
                },
            },
        },
    ],
} as const;

export const ExperimentalCanonicalInteractionConversationEventSchema = z
    .strictObject({
        api_version: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
        type: z.literal('conversation_event'),
        run_id: z.string().min(1),
        host_status: z.enum(['provisional', 'accepted', 'terminated']),
        event: ConversationStreamEventSchema,
    })
    .superRefine((value, context) => {
        const expected =
            value.event.type === 'response_accepted'
                ? 'accepted'
                : value.event.type === 'stream_terminated'
                  ? 'terminated'
                  : 'provisional';
        if (value.host_status !== expected) {
            context.addIssue({
                code: 'custom',
                message: `Conversation stream event ${value.event.type} requires host status ${expected}`,
                path: ['host_status'],
            });
        }
    })
    .meta({
        id: 'ExperimentalCanonicalInteractionConversationEvent',
        ...hostStatusJsonSchema,
    });

export const ExperimentalCanonicalInteractionStreamEnvelopeSchema = z
    .discriminatedUnion('type', [
        ExperimentalCanonicalInteractionStreamOpenedSchema,
        ExperimentalCanonicalInteractionStreamResumedSchema,
        ExperimentalCanonicalInteractionAcceptedRecoveryOpenedSchema,
        ExperimentalCanonicalInteractionConversationEventSchema,
    ])
    .meta({
        id: 'ExperimentalCanonicalInteractionStreamEnvelope',
        type: 'object',
        required: ['type'],
        discriminator: {
            propertyName: 'type',
            mapping: {
                stream_opened: '#/components/schemas/ExperimentalCanonicalInteractionStreamOpened',
                stream_resumed: '#/components/schemas/ExperimentalCanonicalInteractionStreamResumed',
                accepted_recovery_opened: '#/components/schemas/ExperimentalCanonicalInteractionAcceptedRecoveryOpened',
                conversation_event: '#/components/schemas/ExperimentalCanonicalInteractionConversationEvent',
            },
        },
    });
