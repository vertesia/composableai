import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/i);
export const WorkflowJobDelegationSchema = z
    .strictObject({
        job_id: id,
        grant_id: id,
        child_id: id,
        environment: z.string().min(1),
        policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .meta({ id: 'WorkflowJobDelegation' });
export const CreateWorkflowJobPayloadSchema = z
    .strictObject({
        target: z.discriminatedUnion('type', [
            z.strictObject({ type: z.literal('workflow'), name: z.string().min(1) }),
            z.strictObject({ type: z.literal('rule'), id }),
        ]),
        object_ids: z
            .array(id)
            .min(1)
            .max(10000)
            .meta({ description: 'One durable start intent per object; uses the existing bulk request bound.' }),
        vars: z.looseObject({}).optional(),
        task_queue: z.string().min(1).optional(),
        expires_at: z.string().datetime().meta({ description: 'Finite expiry of the job-specific execution grant.' }),
        idempotency_key: z
            .string()
            .min(1)
            .max(256)
            .optional()
            .meta({ description: 'Project/environment-scoped key. Reuse with different input returns 422.' }),
    })
    .meta({ id: 'CreateWorkflowJobPayload' });
export const WorkflowJobSchema = z
    .strictObject({
        id,
        status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
        created_at: z.string().datetime(),
        progress: z.strictObject({
            total: z.number().int().nonnegative(),
            pending: z.number().int().nonnegative(),
            running: z.number().int().nonnegative(),
            succeeded: z.number().int().nonnegative(),
            failed: z.number().int().nonnegative(),
            cancelled: z.number().int().nonnegative(),
        }),
        delegation: z.strictObject({
            id,
            expires_at: z.string().datetime(),
            revoked_at: z.string().datetime().nullable(),
        }),
    })
    .meta({ id: 'WorkflowJob' });
export const WorkflowJobChildrenQuerySchema = z
    .strictObject({
        after: id.optional(),
        limit: z.number().int().min(1).max(500).optional(),
    })
    .meta({ id: 'WorkflowJobChildrenQuery' });
export const WorkflowJobChildSchema = z
    .strictObject({
        id,
        object_id: id,
        status: z.string(),
        workflow_id: z.string().nullable(),
        run_id: z.string().nullable(),
        error: z.string().nullable(),
    })
    .meta({ id: 'WorkflowJobChild' });
export const WorkflowJobChildrenSchema = z
    .strictObject({
        items: z.array(WorkflowJobChildSchema),
        next: id.nullable(),
    })
    .meta({ id: 'WorkflowJobChildren' });
export const WORKFLOW_JOB_SCHEMAS = {
    WorkflowJobDelegation: WorkflowJobDelegationSchema,
    CreateWorkflowJobPayload: CreateWorkflowJobPayloadSchema,
    WorkflowJob: WorkflowJobSchema,
    WorkflowJobChildrenQuery: WorkflowJobChildrenQuerySchema,
    WorkflowJobChild: WorkflowJobChildSchema,
    WorkflowJobChildren: WorkflowJobChildrenSchema,
} as const;

export const WorkflowJobPathParamsSchema = z.strictObject({ jobId: id }).meta({ id: 'WorkflowJobPathParams' });
