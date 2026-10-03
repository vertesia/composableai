import { CanonicalProjectedRequestMeasurementSchema } from '@llumiverse/common/schemas';
import {
    ContentHashSchema,
    ConversationOutputReceiptSchema,
    ConversationRefSchema,
    IdentifierSchema,
    ModelTargetSchema,
    ResolvedConversationRuntimeContextSchema,
    TimestampSchema,
} from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { ExperimentalCanonicalIngestionSourceBindingSchema } from './agent-routing-control.js';
import { CanonicalConversationHeadScopeSchema } from './interaction.js';
import {
    ExperimentalInitialAuthoringViewQuerySchema,
    ExperimentalInitialAuthoringViewResponseSchema,
} from './run-conversation.js';

/** Deliberately excludes target options, native body and input content. Full target identity remains a hash. */
export const ExperimentalCanonicalIngestionConcreteTargetSchema = z
    .strictObject({
        provider: ModelTargetSchema.shape.provider,
        protocol: ModelTargetSchema.shape.protocol,
        model: ModelTargetSchema.shape.model,
        adapter_version: ModelTargetSchema.shape.adapter_version,
    })
    .meta({ id: 'ExperimentalCanonicalIngestionConcreteTarget' });

/** Published bounded derivative count evidence; this is not the ephemeral native projection itself. */
export const ExperimentalCanonicalIngestionCountSchema = CanonicalProjectedRequestMeasurementSchema.extend({
    readiness: CanonicalProjectedRequestMeasurementSchema.shape.readiness.unwrap(),
}).meta({ id: 'ExperimentalCanonicalIngestionCount' });

export const ExperimentalCanonicalIngestionProjectionSchema = z
    .strictObject({
        version: z.literal(1),
        id: ContentHashSchema,
        execution_run_id: IdentifierSchema,
        account_id: IdentifierSchema,
        project_id: IdentifierSchema,
        subject_agent_run_id: IdentifierSchema,
        owner_agent_run_id: IdentifierSchema,
        scope: CanonicalConversationHeadScopeSchema,
        admission_request_id: IdentifierSchema,
        scheduled_semantic_fingerprint: ContentHashSchema,
        target_reference: z.strictObject({ key: z.string().min(1).max(8192), fingerprint: ContentHashSchema }),
        source: ConversationRefSchema,
        source_document_fingerprint: ContentHashSchema,
        source_processing_fingerprint: ContentHashSchema,
        context_fingerprint: ContentHashSchema,
        concrete_target: ExperimentalCanonicalIngestionConcreteTargetSchema,
        target_fingerprint: ContentHashSchema,
        request_id: IdentifierSchema,
        attempt_id: IdentifierSchema,
        input_operation_id: IdentifierSchema,
        response_operation_id: IdentifierSchema,
        virtual_child: z
            .strictObject({
                purpose: z.enum(['virtual_candidate', 'virtual_mediation']),
                environment_id: IdentifierSchema,
                configured_occurrence: z.number().int().min(0).max(255),
                plan_fingerprint: ContentHashSchema,
            })
            .optional(),
        coverage_operation_id: IdentifierSchema,
        measurement_fingerprint: ContentHashSchema,
        count: ExperimentalCanonicalIngestionCountSchema,
        recorded_at: TimestampSchema,
    })
    .meta({ id: 'ExperimentalCanonicalIngestionProjection' });

export const ExperimentalCanonicalIngestionPreparationViewQuerySchema = z
    .strictObject({
        view: z.literal('ingestion_preparation'),
        target_key: ExperimentalCanonicalIngestionProjectionSchema.shape.target_reference.shape.key,
        projection_id: ContentHashSchema,
    })
    .meta({ id: 'ExperimentalCanonicalIngestionPreparationViewQuery' });
export const AvailableCanonicalIngestionPreparationViewSchema = z
    .strictObject({
        status: z.literal('preparation_available'),
        projection: ExperimentalCanonicalIngestionProjectionSchema,
        initial_ingestion_source: ExperimentalCanonicalIngestionSourceBindingSchema.optional(),
    })
    .meta({ id: 'AvailableCanonicalIngestionPreparationView' });
export const UnavailableCanonicalIngestionPreparationViewSchema = z
    .strictObject({ status: z.literal('preparation_unavailable'), reason: z.literal('not_recorded') })
    .meta({ id: 'UnavailableCanonicalIngestionPreparationView' });
export const ExperimentalCanonicalIngestionPreparationViewResponseSchema = z
    .discriminatedUnion('status', [
        AvailableCanonicalIngestionPreparationViewSchema,
        UnavailableCanonicalIngestionPreparationViewSchema,
    ])
    .meta({ id: 'ExperimentalCanonicalIngestionPreparationViewResponse' });

/** Privacy-safe exact retained-preparation descriptor. It does not prove current permission, dispatch
 * outcome or readiness. The inspecting host verifies its existing artifact and immutable target binding.
 */
export const ExperimentalCanonicalIngestionRecoverySchema = z
    .strictObject({
        version: z.literal(1),
        execution_run_id: IdentifierSchema,
        account_id: IdentifierSchema,
        project_id: IdentifierSchema,
        subject_agent_run_id: IdentifierSchema,
        owner_agent_run_id: IdentifierSchema,
        scope: CanonicalConversationHeadScopeSchema,
        admission_request_id: IdentifierSchema,
        scheduled_semantic_fingerprint: ContentHashSchema,
        target_reference: ExperimentalCanonicalIngestionProjectionSchema.shape.target_reference,
        runtime: ResolvedConversationRuntimeContextSchema.pick({
            conversation_id: true,
            request_id: true,
            attempt_id: true,
            input_operation_id: true,
            response_operation_id: true,
            purpose: true,
        }),
        source: ConversationRefSchema,
        request_receipt_id: IdentifierSchema,
        virtual_child: ExperimentalCanonicalIngestionProjectionSchema.shape.virtual_child,
        accepted_output: ConversationOutputReceiptSchema.optional(),
        accepted_output_fingerprint: ContentHashSchema.optional(),
        prepared_record_fingerprint: ContentHashSchema,
        native_request_fingerprint: ContentHashSchema,
        context_fingerprint: ContentHashSchema,
        tool_set_fingerprint: ContentHashSchema,
        concrete_target: ExperimentalCanonicalIngestionConcreteTargetSchema,
        target_fingerprint: ContentHashSchema,
        recorded_at: TimestampSchema,
    })
    .meta({ id: 'ExperimentalCanonicalIngestionRecovery' });
export const ExperimentalCanonicalIngestionRecoveryViewQuerySchema = z
    .strictObject({
        view: z.literal('ingestion_recovery'),
        target_key: ExperimentalCanonicalIngestionProjectionSchema.shape.target_reference.shape.key,
        request_id: IdentifierSchema,
    })
    .meta({ id: 'ExperimentalCanonicalIngestionRecoveryViewQuery' });
export const AvailableCanonicalIngestionRecoveryViewSchema = z
    .strictObject({ status: z.literal('recovery_available'), recovery: ExperimentalCanonicalIngestionRecoverySchema })
    .meta({ id: 'AvailableCanonicalIngestionRecoveryView' });
export const UnavailableCanonicalIngestionRecoveryViewSchema = z
    .strictObject({ status: z.literal('recovery_unavailable'), reason: z.literal('not_recorded') })
    .meta({ id: 'UnavailableCanonicalIngestionRecoveryView' });
export const ExperimentalCanonicalIngestionRecoveryViewResponseSchema = z
    .discriminatedUnion('status', [
        AvailableCanonicalIngestionRecoveryViewSchema,
        UnavailableCanonicalIngestionRecoveryViewSchema,
    ])
    .meta({ id: 'ExperimentalCanonicalIngestionRecoveryViewResponse' });

/** Existing exact-version GET keeps the initial authoring branch unchanged. */
export const ExperimentalRunConversationInspectionQuerySchema = z
    .discriminatedUnion('view', [
        ExperimentalInitialAuthoringViewQuerySchema,
        ExperimentalCanonicalIngestionPreparationViewQuerySchema,
        ExperimentalCanonicalIngestionRecoveryViewQuerySchema,
    ])
    .meta({ id: 'ExperimentalRunConversationInspectionQuery' });
/** One flat status discriminator avoids nested generated-client union wrappers. The existing view
 * responses contribute their exact strict objects; accepted JSON and per-view validation are unchanged.
 * The finite view mapping retains previously published wrapper models as useful inspection documentation.
 */
export const ExperimentalRunConversationInspectionResponseSchema = z
    .discriminatedUnion('status', [
        ...ExperimentalInitialAuthoringViewResponseSchema.options,
        ...ExperimentalCanonicalIngestionPreparationViewResponseSchema.options,
        ...ExperimentalCanonicalIngestionRecoveryViewResponseSchema.options,
    ])
    .meta({
        id: 'ExperimentalRunConversationInspectionResponse',
        'x-vertesia-inspection-view-responses': {
            initial_authoring: { $ref: '#/components/schemas/ExperimentalInitialAuthoringViewResponse' },
            ingestion_preparation: {
                $ref: '#/components/schemas/ExperimentalCanonicalIngestionPreparationViewResponse',
            },
            ingestion_recovery: { $ref: '#/components/schemas/ExperimentalCanonicalIngestionRecoveryViewResponse' },
        },
    });
