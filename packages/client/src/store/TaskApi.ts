import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { CompleteTaskPayload, CreateTaskPayload, ListTasksQuery, Task, UpdateTaskPayload } from '@vertesia/common';

export class TaskApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/tasks');
    }

    /**
     * Lists tasks.
     *
     * `status` accepts one value or several, and several go out as a repeated key
     * (`status=a&status=b`) — which is what the parameter publishes: `style: form`, `explode: true`.
     * This used to comma-join the array before sending it. Servers still split each occurrence on
     * commas so SDKs pinned to an older version keep working, but that form was never in the spec,
     * so newly published clients send the declared one.
     */
    list(query: ListTasksQuery = {}): Promise<Task[]> {
        return this.get('/', { query });
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
