import type * as Wire from '../wire-types.generated.js';

export type DurableTaskStatus = Wire.DurableTaskStatus;

export type TaskFieldType = Wire.TaskFieldType;

export type TaskField = Wire.TaskField;

export type TaskSource = Wire.TaskSource;

/**
 * The timestamps are ISO date-time STRINGS, not `Date`: this is the wire shape, and JSON has no date
 * type. The Mongoose model keeps `Date` — persistence and transport are different contracts.
 */
export type Task = Wire.Task;

export type CreateTaskPayload = Wire.CreateTaskPayload;

export type UpdateTaskPayload = Wire.UpdateTaskPayload;

export type CompleteTaskPayload = Wire.CompleteTaskPayload;

export type ListTasksQuery = Wire.ListTasksQuery;
