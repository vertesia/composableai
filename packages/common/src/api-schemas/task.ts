import { z } from 'zod';

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

/**
 * The `GET /tasks` query contract.
 *
 * `source_type` reuses `TaskSourceSchema.shape.type` rather than restating `'process' | 'agent'`.
 * The scanner-opacity problem that forced spelling it out in TypeScript was specific to
 * `TaskSource['type']`: an indexed access into a canonical alias reads as nothing to a scanner that
 * works from source text, and the parameter silently vanished from the published operation. Zod is a
 * value, so reaching into its shape is an ordinary property read and the enum arrives intact.
 *
 * `status` is published as a single `type: array` parameter with `explode: true` — the scanner
 * collapses `X | X[]` that way, because repeated keys are the only serialization OpenAPI has for it.
 * The runtime additionally accepts the comma-joined spelling the SDK emits; see `commaSafeEnum` in
 * `./parameters.js` for why that is safe for an enum specifically.
 */
export const ListTasksQuerySchema = z
    .strictObject({
        status: z.union([DurableTaskStatusSchema, z.array(DurableTaskStatusSchema)]).optional(),
        assignee: z.string().optional(),
        run_id: z.string().optional(),
        source_type: TaskSourceSchema.shape.type.optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
    })
    .meta({ id: 'ListTasksQuery' });
