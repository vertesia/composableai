import {
    ConversationDocumentSchema,
    ConversationRefSchema,
    ConversationStreamCursorSchema,
    ConversationStreamEventSchema,
    IdentifierSchema,
    ToolCallSourceRefSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { RunDataStorageLevel } from '../interaction-values.js';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE } from '../versions.js';
import { ExperimentalAgentRoutingControlSelectorSchema } from './agent-routing-control.js';
import { ExperimentalCanonicalNamedInteractionExecutionRequestSchema } from './canonical-interaction-execution.js';
import { AsyncCompletionOptionsSchema } from './interaction.js';

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

const ordinaryCanonicalInteractionStreamRequestSchema = z
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
    });

type SchemaOutput<Schema extends z.ZodType> = z.output<Schema>;

/** The existing named authoring validator/refinements remain authoritative inside this constrained initial branch. */
const initialAgentExecutionConstraintsSchema = z
    .object({
        initial_state: z.strictObject({ type: z.literal('document'), document: ConversationDocumentSchema }),
        retention: z.literal(RunDataStorageLevel.DEBUG),
        return_policy: z.strictObject({ history: z.literal('none') }),
    })
    // This is a narrowing conjunct, not the object-authority branch. The named validator rejects unknown fields.
    .meta({ additionalProperties: true });
// Keep the existing named validator intact; a schema-derived output boundary avoids expanding its recursive
// document graph in every exported request declaration. This does not replace any runtime validation.
const initialAgentExecutionRequestSchema: z.ZodType<
    SchemaOutput<typeof ExperimentalCanonicalNamedInteractionExecutionRequestSchema> &
        Pick<
            SchemaOutput<typeof initialAgentExecutionConstraintsSchema>,
            'initial_state' | 'retention' | 'return_policy'
        >
> = z.intersection(ExperimentalCanonicalNamedInteractionExecutionRequestSchema, initialAgentExecutionConstraintsSchema);

/** Initial activity membership is distinct from ordinary authoring and has no fabricated ExecutionRun or head. */
export const ExperimentalCanonicalInitialAgentStreamRequestSchema = z
    .strictObject({
        kind: z.literal('initial_agent'),
        operation_id: IdentifierSchema,
        resume_after: ConversationStreamCursorSchema.optional(),
        request: initialAgentExecutionRequestSchema,
        agent_acceptance: ExperimentalCanonicalAgentAcceptanceTargetSchema,
        activity_delivery: z.strictObject({
            activity_id: AsyncCompletionOptionsSchema.shape.activity_id.unwrap().min(1),
            run_id: AsyncCompletionOptionsSchema.shape.run_id.min(1),
            task_token: AsyncCompletionOptionsSchema.shape.task_token.unwrap().min(1),
        }),
    })
    .meta({ id: 'ExperimentalCanonicalInitialAgentStreamRequest' });

/** Parent references and prompt text nominate facts for verification, never permission or a generation target. */
export const ExperimentalCanonicalToolApprovalReviewStreamRequestSchema = z
    .strictObject({
        kind: z.literal('tool_approval_review'),
        operation_id: IdentifierSchema,
        parent: z.strictObject({ execution_run_id: IdentifierSchema, generation_request_id: IdentifierSchema }),
        source: ToolCallSourceRefSchema,
        control: ExperimentalAgentRoutingControlSelectorSchema,
        request: z.strictObject({
            interaction: z.literal('sys:ToolApprovalReviewer'),
            data: z.strictObject({
                approval_request_json: z.string().max(64 * 1024),
                intent_json: z.string().max(64 * 1024),
            }),
        }),
        agent_acceptance: ExperimentalCanonicalAgentAcceptanceTargetSchema,
        activity_delivery: ExperimentalCanonicalInitialAgentStreamRequestSchema.shape.activity_delivery,
        resume_after: ConversationStreamCursorSchema.optional(),
    })
    .meta({ id: 'ExperimentalCanonicalToolApprovalReviewStreamRequest' });

// The old branch deliberately has no new discriminator: its strict wire bytes and validator are unchanged.
export const ExperimentalCanonicalInteractionStreamRequestSchema: z.ZodType<
    | SchemaOutput<typeof ordinaryCanonicalInteractionStreamRequestSchema>
    | SchemaOutput<typeof ExperimentalCanonicalInitialAgentStreamRequestSchema>
    | SchemaOutput<typeof ExperimentalCanonicalToolApprovalReviewStreamRequestSchema>
> = z
    .union([
        ordinaryCanonicalInteractionStreamRequestSchema,
        ExperimentalCanonicalInitialAgentStreamRequestSchema,
        ExperimentalCanonicalToolApprovalReviewStreamRequestSchema,
    ])
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

/** Initial-only delivery ACK. No response, admission, target, stream cursor or provider event is invented.
 * The actual Temporal completion carries the private authenticated pending receipt separately. */
export const ExperimentalCanonicalInitialIngestionAcceptedSchema = z
    .strictObject({
        api_version: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
        type: z.literal('ingestion_accepted'),
        run_id: IdentifierSchema,
        operation_id: IdentifierSchema,
        accepted_source: ConversationRefSchema,
    })
    .meta({ id: 'ExperimentalCanonicalInitialIngestionAccepted' });

export const ExperimentalCanonicalInteractionStreamEnvelopeSchema = z
    .discriminatedUnion('type', [
        ExperimentalCanonicalInitialIngestionAcceptedSchema,
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
                ingestion_accepted: '#/components/schemas/ExperimentalCanonicalInitialIngestionAccepted',
                stream_opened: '#/components/schemas/ExperimentalCanonicalInteractionStreamOpened',
                stream_resumed: '#/components/schemas/ExperimentalCanonicalInteractionStreamResumed',
                accepted_recovery_opened: '#/components/schemas/ExperimentalCanonicalInteractionAcceptedRecoveryOpened',
                conversation_event: '#/components/schemas/ExperimentalCanonicalInteractionConversationEvent',
            },
        },
    });
