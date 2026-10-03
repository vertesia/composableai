import {
    ContentHashSchema,
    ConversationOutputReceiptSchema,
    ConversationRefSchema,
    IdentifierSchema,
    NonnegativeSafeIntegerSchema,
    OperationReceiptSchema,
    TimestampSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE } from '../versions.js';
import { AgentRunAccessQuerySchema, UpdateAgentRunStatusPayloadSchema } from './agent-runs.js';
import { InferenceProfileIdSchema } from './inference-profile.js';
import { CanonicalConversationHeadScopeSchema } from './interaction.js';

const id = IdentifierSchema.max(1024);
const model = UpdateAgentRunStatusPayloadSchema.shape.model.unwrap().max(1024).regex(/\S/);
const effort = UpdateAgentRunStatusPayloadSchema.shape.effort.unwrap();
export const ExperimentalAgentRoutingIntentSchema = z
    .union([
        z.strictObject({ model: model.optional(), effort: effort.optional() }),
        z.strictObject({ inference_profile: InferenceProfileIdSchema, effort: effort.optional() }),
    ])
    .meta({ id: 'ExperimentalAgentRoutingIntent', additionalProperties: true });
/** Selecting a profile or model replaces the prior route; effort-only updates retain it. */
export const ExperimentalAgentRoutingControlChangeSchema = z
    .union([
        z.strictObject({ model, effort: effort.optional() }),
        z.strictObject({ effort }),
        z.strictObject({ inference_profile: InferenceProfileIdSchema, effort: effort.optional() }),
    ])
    .meta({ id: 'ExperimentalAgentRoutingControlChange', additionalProperties: true });
export const ExperimentalAgentRoutingControlBindingSchema = z
    .strictObject({
        account_id: id,
        project_id: id,
        subject_agent_run_id: id,
        owner_agent_run_id: id,
        scope: CanonicalConversationHeadScopeSchema,
        namespace_origin_first_run_id: id,
    })
    .meta({ id: 'ExperimentalAgentRoutingControlBinding' });
/** Immutable provenance of the actual persisted initial execution; never selects current delivery. */
export const ExperimentalAgentRoutingOriginExecutionSchema = z
    .strictObject({
        workflow_id: id,
        first_run_id: id,
    })
    .meta({ id: 'ExperimentalAgentRoutingOriginExecution' });

export const ExperimentalUpdateAgentRoutingControlPayloadSchema = z
    .strictObject({
        operation_id: id,
        expected_revision: NonnegativeSafeIntegerSchema,
        recorded_at: TimestampSchema,
        change: ExperimentalAgentRoutingControlChangeSchema,
    })
    .meta({ id: 'ExperimentalUpdateAgentRoutingControlPayload' });
const receipt = {
    version: z.literal(2),
    origin_execution: ExperimentalAgentRoutingOriginExecutionSchema,
    owner: ExperimentalAgentRoutingControlBindingSchema,
    operation_id: id,
    recorded_at: TimestampSchema,
    payload_fingerprint: id,
    base_revision: NonnegativeSafeIntegerSchema,
    result_revision: NonnegativeSafeIntegerSchema,
    intent: ExperimentalAgentRoutingIntentSchema,
};
export const ExperimentalAgentRoutingInitialReceiptSchema = z
    .strictObject({ ...receipt, kind: z.literal('initial') })
    .meta({ id: 'ExperimentalAgentRoutingInitialReceipt' });
export const ExperimentalAgentRoutingChangeReceiptSchema = z
    .strictObject({
        ...receipt,
        kind: z.literal('change'),
        previous_receipt_id: id,
        change: ExperimentalAgentRoutingControlChangeSchema,
    })
    .meta({ id: 'ExperimentalAgentRoutingChangeReceipt' });
export const ExperimentalAgentRoutingControlReceiptSchema = z
    .discriminatedUnion('kind', [
        ExperimentalAgentRoutingInitialReceiptSchema,
        ExperimentalAgentRoutingChangeReceiptSchema,
    ])
    .meta({
        id: 'ExperimentalAgentRoutingControlReceipt',
        type: 'object',
        required: ['kind'],
        discriminator: {
            propertyName: 'kind',
            mapping: {
                initial: '#/components/schemas/ExperimentalAgentRoutingInitialReceipt',
                change: '#/components/schemas/ExperimentalAgentRoutingChangeReceipt',
            },
        },
        additionalProperties: true,
    });
export const ExperimentalAgentRoutingControlSelectorSchema = z
    .strictObject({
        operation_id: id,
        revision: NonnegativeSafeIntegerSchema,
    })
    .meta({ id: 'ExperimentalAgentRoutingControlSelector' });
export const ExperimentalAgentRoutingControlQuerySchema = AgentRunAccessQuerySchema.extend({
    access: z.literal('control'),
    routing_control_operation_id: id.optional(),
}).meta({ id: 'ExperimentalAgentRoutingControlQuery' });
export const ExperimentalAgentRoutingControlResponseSchema = z
    .strictObject({
        api_version: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
        routing_control: ExperimentalAgentRoutingControlReceiptSchema,
    })
    .meta({ id: 'ExperimentalAgentRoutingControlResponse' });

/** Server-validated current delivery, separate from immutable logical namespace ownership. */
export const ExperimentalAgentRoutingExecutionBindingSchema = z
    .strictObject({
        workflow_id: id,
        chain_first_run_id: id,
    })
    .meta({ id: 'ExperimentalAgentRoutingExecutionBinding' });
export const ExperimentalAgentGenerationAdmissionPayloadSchema = z
    .strictObject({
        request_id: id,
        control: ExperimentalAgentRoutingControlSelectorSchema,
        input_fingerprint: id,
    })
    .meta({ id: 'ExperimentalAgentGenerationAdmissionPayload' });
/** Server-authored immutable ingestion lineage data. It grants neither readiness nor current execution. */
export const ExperimentalCanonicalIngestionSourceBindingSchema = z
    .strictObject({
        version: z.literal(1),
        accepted_source: ConversationRefSchema,
        accepted_anchor: z.discriminatedUnion('kind', [
            z.strictObject({ kind: z.literal('accepted_input'), receipt: OperationReceiptSchema }),
            z.strictObject({ kind: z.literal('retained_output'), receipt: ConversationOutputReceiptSchema }),
        ]),
        effective_source: ConversationRefSchema,
        document_fingerprint: ContentHashSchema,
        processing_fingerprint: ContentHashSchema,
    })
    .meta({ id: 'ExperimentalCanonicalIngestionSourceBinding' });
/** A request identity admits one immutable intent on one actual execution; a new chain cannot reuse it. */
export const ExperimentalAgentGenerationAdmissionReceiptSchema = z
    .strictObject({
        version: z.literal(1),
        request_id: id,
        input_fingerprint: id,
        admitted_at: TimestampSchema,
        // Required by fresh ordinary services; absence is only retained/other-purpose compatibility.
        ingestion_source: ExperimentalCanonicalIngestionSourceBindingSchema.optional(),
        execution: ExperimentalAgentRoutingExecutionBindingSchema,
        routing_control: ExperimentalAgentRoutingControlReceiptSchema,
    })
    .meta({ id: 'ExperimentalAgentGenerationAdmissionReceipt' });
export const ExperimentalAgentRoutingStatusPayloadSchema = z
    .discriminatedUnion('kind', [
        z.strictObject({
            kind: z.literal('routing_control_change'),
            command: ExperimentalUpdateAgentRoutingControlPayloadSchema,
        }),
        ExperimentalAgentGenerationAdmissionPayloadSchema.extend({ kind: z.literal('generation_admission') }),
    ])
    .meta({
        id: 'ExperimentalAgentRoutingStatusPayload',
        type: 'object',
        required: ['kind'],
        discriminator: { propertyName: 'kind' },
        additionalProperties: true,
    });
export const ExperimentalAgentRoutingStatusResponseSchema = z
    .discriminatedUnion('kind', [
        ExperimentalAgentRoutingControlResponseSchema.extend({ kind: z.literal('routing_control_change') }),
        z.strictObject({
            kind: z.literal('generation_admission'),
            api_version: z.literal(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
            generation_admission: ExperimentalAgentGenerationAdmissionReceiptSchema,
        }),
    ])
    .meta({
        id: 'ExperimentalAgentRoutingStatusResponse',
        type: 'object',
        required: ['kind'],
        discriminator: { propertyName: 'kind' },
        additionalProperties: true,
    });
