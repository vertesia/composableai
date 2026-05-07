import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import {
    CompleteTaskPayload,
    CreateTaskPayload,
    ListTasksQuery,
    Task,
    UpdateTaskPayload,
} from '@vertesia/common';

export class TaskApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/tasks');
    }

    list(query?: ListTasksQuery): Promise<Task[]> {
        const params: Record<string, string> = {};
        if (query?.status) {
            params.status = Array.isArray(query.status) ? query.status.join(',') : query.status;
        }
        if (query?.assignee) params.assignee = query.assignee;
        if (query?.run_id) params.run_id = query.run_id;
        if (query?.source_type) params.source_type = query.source_type;
        if (query?.limit != null) params.limit = String(query.limit);
        if (query?.offset != null) params.offset = String(query.offset);
        return this.get('/', { query: params });
    }

    retrieve(id: string): Promise<Task> {
        return this.get(`/${id}`);
    }

    create(payload: CreateTaskPayload): Promise<Task> {
        return this.post('/', { payload });
    }

    update(id: string, payload: UpdateTaskPayload): Promise<Task> {
        return this.put(`/${id}`, { payload });
    }

    complete(id: string, payload: CompleteTaskPayload): Promise<Task> {
        return this.post(`/${id}/complete`, { payload });
    }

    cancel(id: string): Promise<Task> {
        return this.post(`/${id}/cancel`, {});
    }

    delete(id: string): Promise<{ id: string; count: number }> {
        return this.del(`/${id}`);
    }
}
