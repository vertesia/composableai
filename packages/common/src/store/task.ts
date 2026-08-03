/**
 * Durable human task types used by process human_task nodes and agent asks.
 */
import type { z } from 'zod';
import type {
    CompleteTaskPayloadSchema,
    CreateTaskPayloadSchema,
    DurableTaskStatusSchema,
    ListTasksQuerySchema,
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

export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;
