import { z } from 'zod';
import { conditional, PageCountSchema } from './schema-primitives.js';

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
        run_id: z.string().min(1),
        node: z.string().optional(),
        ask_id: z.string().optional(),
        request_key: z
            .string()
            .min(1)
            .max(512)
            .optional()
            .meta({
                description:
                    'Stable key of the agent request this task answers (`<run_id>:<tool_use_id>`). Unique in the ' +
                    'project: creating a task whose source repeats an existing request key returns that task instead ' +
                    'of creating a second one.',
            }),
        request_id: z.string().optional().meta({
            description: 'Tool-use id of the agent request (the REQUEST_INPUT message) this task answers.',
        }),
        approval_key: z.string().optional().meta({
            description: 'For a tool approval task, the approval key (`tool_name:target`) the decision applies to.',
        }),
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

/** The `if` fragment for a task field of one of these types. */
function fieldOfType(...types: string[]): Record<string, unknown> {
    return { required: ['type'], properties: { type: { enum: types } } };
}

/**
 * What a create or update checks of each field it writes: a non-empty name, a `default` of the field's own type,
 * and options for a `select`. Stated on the payloads rather than on `TaskField`, which is also the shape of a process
 * definition's human task fields, where none of these is checked. A select default must also be one of the options when there are any;
 * that relation between two fields is the server's alone.
 */
const TASK_FIELD_WRITE_RULES = {
    allOf: [
        {
            properties: {
                fields: {
                    items: {
                        allOf: [
                            // The stored field requires a name, and an empty string does not count as one.
                            { properties: { name: { minLength: 1 } } },
                            conditional(fieldOfType('string', 'text', 'select'), {
                                properties: { default: { type: 'string' } },
                            }),
                            conditional(fieldOfType('number'), { properties: { default: { type: 'number' } } }),
                            conditional(fieldOfType('boolean'), { properties: { default: { type: 'boolean' } } }),
                            conditional(fieldOfType('select'), {
                                required: ['options'],
                                properties: { options: { minItems: 1 } },
                            }),
                        ],
                    },
                },
            },
        },
    ],
};

const TASK_FIELD_WRITE_DESCRIPTION =
    'Each field has a non-empty `name`, and its `default` has the field type: a string for `string`, `text` and ' +
    '`select`, a number for `number`, a boolean for `boolean`. A `select` field needs at least one option, and its default must be one of them.';

export const CreateTaskPayloadSchema = z
    .strictObject({
        title: z.string().min(1),
        description: z.string().optional(),
        assignee: z.string().optional(),
        fields: z.array(TaskFieldSchema).optional(),
        source: TaskSourceSchema,
        due_at: z.string().meta({ format: 'date-time' }).optional(),
    })
    .meta({ id: 'CreateTaskPayload', description: TASK_FIELD_WRITE_DESCRIPTION, ...TASK_FIELD_WRITE_RULES });

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
        assignment_rev: z.number().int().optional().meta({
            description: 'Assignment revision: 1 at creation, incremented every time the assignee changes.',
        }),
        assigned_at: z
            .string()
            .meta({ format: 'date-time', description: 'When the current assignment revision started.' })
            .optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        completed_at: z.string().meta({ format: 'date-time' }).optional(),
        updated_at: z.string().meta({ format: 'date-time' }).optional(),
    })
    .meta({ id: 'Task' });

export const UpdateTaskPayloadSchema = z
    .strictObject({
        // A task always has a title: the stored document requires a non-empty one.
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        status: DurableTaskStatusSchema.optional(),
        assignee: z.string().nullable().optional(),
        fields: z.array(TaskFieldSchema).optional(),
        due_at: z.union([z.string().meta({ format: 'date-time' }), z.null()]).optional(),
    })
    .meta({ id: 'UpdateTaskPayload', description: TASK_FIELD_WRITE_DESCRIPTION, ...TASK_FIELD_WRITE_RULES });

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
        limit: PageCountSchema.optional(),
        offset: PageCountSchema.optional(),
    })
    .meta({ id: 'ListTasksQuery' });
