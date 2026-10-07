import { ContentHashSchema, ConversationRefSchema, IdentifierSchema } from '@llumiverse/conversation/schemas';
import { z } from 'zod';
import { ExperimentalAgentGenerationAdmissionReceiptSchema } from './agent-routing-control.js';
import { ExperimentalCanonicalVirtualGenerationBindingSchema } from './canonical-interaction-execution.js';

const id = IdentifierSchema.max(1024);
const hash = ContentHashSchema.regex(/^sha256:[a-f0-9]{64}$/);
/** Host-proven execution; no request can declare these authority fields. */
export const ExperimentalAgentRestartAdmissionExecutionSchema = z
    .strictObject({
        workflow_id: id,
        first_run_id: id,
        execution_run_id: id,
        namespace: id,
        task_queue: id,
        workflow_type: z.literal('ExecuteAdmittedAgentRestartWorkflowV2'),
        start_fingerprint: hash,
    })
    .meta({ id: 'ExperimentalAgentRestartAdmissionExecution' });
export const ExperimentalAgentRestartAdmissionPayloadSchema = z
    .strictObject({
        version: z.literal(2),
        token: IdentifierSchema.regex(/^[a-f0-9-]{36}$/),
    })
    .meta({ id: 'ExperimentalAgentRestartAdmissionPayload' });
export const ExperimentalAgentRestartAdmissionResponseSchema = z
    .strictObject({
        version: z.literal(2),
        status: z.literal('admitted'),
        token: ExperimentalAgentRestartAdmissionPayloadSchema.shape.token,
        policy_id: hash,
        execution: ExperimentalAgentRestartAdmissionExecutionSchema,
    })
    .meta({ id: 'ExperimentalAgentRestartAdmissionResponse' });

/** Opaque actual activity delivery only. Source, subject and parent authority are read by the service. */
export const ExperimentalAgentWorkstreamRestartAdmissionPayloadSchema = z
    .strictObject({
        version: z.literal(1),
        workflow_id: id,
        run_id: id,
        activity_id: id,
        task_token: z
            .string()
            .min(1)
            .max(16 * 1024)
            .regex(/^[A-Za-z0-9_-]+$/),
    })
    .meta({ id: 'ExperimentalAgentWorkstreamRestartAdmissionPayload' });

export const ExperimentalAgentWorkstreamRestartAdmissionResponseSchema = z
    .strictObject({
        version: z.literal(1),
        kind: z.literal('workstream_restart'),
        status: z.literal('admitted'),
        subject_agent_run_id: id,
        owner_agent_run_id: id,
        scope: z
            .string()
            .min(12)
            .max(139)
            .regex(/^workstream:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
        launch_id: id.regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
        workstream_id: id,
        namespace_origin_first_run_id: id,
        execution: z.strictObject({
            workflow_id: id,
            execution_run_id: id,
            first_run_id: id,
            namespace: id,
            task_queue: id,
            workflow_type: z.literal('ExecuteConversationWorkflow'),
            start_fingerprint: hash,
        }),
        source: z.strictObject({
            execution_run_id: id,
            source_first_run_id: id,
            head: ConversationRefSchema,
            document_fingerprint: hash,
            accepted_output_fingerprint: hash,
            generation_admission: ExperimentalAgentGenerationAdmissionReceiptSchema,
            virtual_generation: ExperimentalCanonicalVirtualGenerationBindingSchema.optional(),
        }),
    })
    .meta({ id: 'ExperimentalAgentWorkstreamRestartAdmissionResponse' });

/** Nomination only: service observes closure and fences the exact persisted child binding. */
export const ExperimentalAgentWorkstreamTerminalPayloadSchema = z
    .strictObject({
        version: z.literal(1),
        subject_agent_run_id: id,
        workflow_id: id,
        chain_first_run_id: id,
    })
    .meta({ id: 'ExperimentalAgentWorkstreamTerminalPayload' });

export const ExperimentalAgentWorkstreamTerminalResponseSchema = z
    .strictObject({
        version: z.literal(1),
        outcome: z.enum(['running', 'projected', 'already_projected', 'not_current']),
    })
    .meta({ id: 'ExperimentalAgentWorkstreamTerminalResponse' });
