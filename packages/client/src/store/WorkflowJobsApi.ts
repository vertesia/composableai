import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateWorkflowJobPayload,
    WorkflowJob,
    WorkflowJobChildren,
    WorkflowJobChildrenQuery,
} from '@vertesia/common';
import { withIdempotencyKey } from '../idempotency-key.js';

/** Durable, independently admitted child executions with a finite, revocable job grant. */
export class WorkflowJobsApi extends ApiTopic {
    constructor(client: ClientBase) {
        super(client, '/api/v1/workflows/jobs');
    }
    create(payload: CreateWorkflowJobPayload): Promise<WorkflowJob> {
        return this.post('', { payload: withIdempotencyKey(this.client, payload) });
    }
    retrieve(id: string): Promise<WorkflowJob> {
        return this.get(`/${encodeURIComponent(id)}`);
    }
    children(id: string, query: WorkflowJobChildrenQuery = {}): Promise<WorkflowJobChildren> {
        return this.get(`/${encodeURIComponent(id)}/children`, { query });
    }
    revoke(id: string): Promise<WorkflowJob> {
        return this.post(`/${encodeURIComponent(id)}/revoke`);
    }
}
