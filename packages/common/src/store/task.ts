/**
 * Durable human task types used by process human_task nodes and agent asks.
 */
import type { z } from 'zod';
import type {
    CompleteTaskPayloadSchema,
    CreateTaskPayloadSchema,
    DurableTaskStatusSchema,
    TaskFieldSchema,
    TaskFieldTypeSchema,
    TaskSchema,
    TaskSourceSchema,
    UpdateTaskPayloadSchema,
} from '../api-schemas/task.js';

export type DurableTaskStatus = z.infer<typeof DurableTaskStatusSchema>;

export type TaskFieldType = z.infer<typeof TaskFieldTypeSchema>;

export type TaskField = z.infer<typeof TaskFieldSchema>;

export type TaskSource = z.infer<typeof TaskSourceSchema>;

/**
 * The timestamps are ISO date-time STRINGS, not `Date`: this is the wire shape, and JSON has no date
 * type. The Mongoose model keeps `Date` — persistence and transport are different contracts.
 */
export type Task = z.infer<typeof TaskSchema>;

export type CreateTaskPayload = z.infer<typeof CreateTaskPayloadSchema>;

export type UpdateTaskPayload = z.infer<typeof UpdateTaskPayloadSchema>;

export type CompleteTaskPayload = z.infer<typeof CompleteTaskPayloadSchema>;

export interface ListTasksQuery {
    status?: DurableTaskStatus | DurableTaskStatus[];
    assignee?: string;
    run_id?: string;
    // Spelled out rather than `TaskSource['type']`: an indexed access into a canonical alias is
    // opaque to the OpenAPI scanner, and the parameter silently disappeared from the published
    // operation — and from the generated clients' `listTasks` signature.
    source_type?: 'process' | 'agent';
    limit?: number;
    offset?: number;
}
