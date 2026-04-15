/**
 * Durable human task types used by process human_task nodes and agent asks.
 */

export type DurableTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type TaskFieldType = 'string' | 'number' | 'boolean' | 'select' | 'text';

export interface TaskField {
    name: string;
    type: TaskFieldType;
    required?: boolean;
    label?: string;
    options?: string[];
    default?: any;
}

export interface TaskSource {
    type: 'process' | 'agent';
    run_id: string;
    node?: string;
}

export interface Task {
    id: string;
    account: string;
    project: string;
    title: string;
    description?: string;
    status: DurableTaskStatus;
    assignee?: string;
    fields: TaskField[];
    result?: Record<string, any>;
    source: TaskSource;
    due_at?: Date;
    created_at: Date;
    completed_at?: Date;
    updated_at?: Date;
}

export interface CreateTaskPayload {
    title: string;
    description?: string;
    assignee?: string;
    fields?: TaskField[];
    source: TaskSource;
    due_at?: Date;
}

export interface UpdateTaskPayload {
    title?: string;
    description?: string;
    status?: DurableTaskStatus;
    assignee?: string | null;
    fields?: TaskField[];
    due_at?: Date | null;
}

export interface CompleteTaskPayload {
    result: Record<string, any>;
}

export interface ListTasksQuery {
    status?: DurableTaskStatus | DurableTaskStatus[];
    assignee?: string;
    run_id?: string;
    source_type?: TaskSource['type'];
    limit?: number;
    offset?: number;
}
