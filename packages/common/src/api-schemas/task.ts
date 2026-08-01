import { z } from 'zod';

/**
 * Generated from the published components by `scripts/convert-to-zod.mjs`, then reviewed.
 *
 * Every schema below was checked against the document it replaces: `--verify` re-emits this
 * module through the registry adapter and diffs it, so the shapes are the shipped ones.
 */
export const CompleteTaskPayloadSchema = z
    .strictObject({
        result: z.looseObject({}),
    })
    .meta({ id: 'CompleteTaskPayload' });

export const TaskFieldTypeSchema = z
    .enum(['string', 'number', 'boolean', 'select', 'text'])
    .meta({ id: 'TaskFieldType' });

export const DurableTaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']).meta({
    id: 'DurableTaskStatus',
    description: 'Durable human task types used by process human_task nodes and agent asks.',
});

export const TaskSourceSchema = z
    .strictObject({
        type: z.enum(['process', 'agent']),
        run_id: z.string(),
        node: z.string().optional(),
        ask_id: z.string().optional(),
    })
    .meta({ id: 'TaskSource' });

export const TaskFieldSchema = z
    .strictObject({
        name: z.string(),
        type: TaskFieldTypeSchema,
        required: z.boolean().optional(),
        label: z.string().optional(),
        options: z.array(z.string()).optional(),
        default: z.unknown().optional(),
    })
    .meta({ id: 'TaskField' });

export const CreateTaskPayloadSchema = z
    .strictObject({
        title: z.string(),
        description: z.string().optional(),
        assignee: z.string().optional(),
        fields: z.array(TaskFieldSchema).optional(),
        source: TaskSourceSchema,
        due_at: z.string().meta({ format: 'date-time' }).optional(),
    })
    .meta({ id: 'CreateTaskPayload' });

export const TaskSchema = z
    .strictObject({
        id: z.string(),
        account: z.string(),
        project: z.string(),
        title: z.string(),
        description: z.string().optional(),
        status: DurableTaskStatusSchema,
        assignee: z.string().optional(),
        fields: z.array(TaskFieldSchema),
        result: z.looseObject({}).optional(),
        source: TaskSourceSchema,
        due_at: z.string().meta({ format: 'date-time' }).optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        completed_at: z.string().meta({ format: 'date-time' }).optional(),
        updated_at: z.string().meta({ format: 'date-time' }).optional(),
    })
    .meta({ id: 'Task' });

export const UpdateTaskPayloadSchema = z
    .strictObject({
        title: z.string().optional(),
        description: z.string().optional(),
        status: DurableTaskStatusSchema.optional(),
        assignee: z.string().nullable().optional(),
        fields: z.array(TaskFieldSchema).optional(),
        due_at: z.union([z.string().meta({ format: 'date-time' }), z.null()]).optional(),
    })
    .meta({ id: 'UpdateTaskPayload' });

export const TaskArraySchema = z.array(TaskSchema).meta({ id: 'TaskArray' });
