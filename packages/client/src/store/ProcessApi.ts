import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import {
    CreateProcessDefinitionPayload,
    ProcessDefinition,
    UpdateProcessDefinitionPayload,
} from '@vertesia/common';

export class ProcessApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/processes');
    }

    list(query?: { status?: string; process?: string; limit?: number; offset?: number }): Promise<ProcessDefinition[]> {
        const params: Record<string, string> = {};
        if (query?.status) params.status = query.status;
        if (query?.process) params.process = query.process;
        if (query?.limit != null) params.limit = String(query.limit);
        if (query?.offset != null) params.offset = String(query.offset);
        return this.get('/', { query: params });
    }

    retrieve(id: string): Promise<ProcessDefinition> {
        return this.get(`/${id}`);
    }

    create(payload: CreateProcessDefinitionPayload): Promise<ProcessDefinition> {
        return this.post('/', { payload });
    }

    update(id: string, payload: UpdateProcessDefinitionPayload): Promise<ProcessDefinition> {
        return this.put(`/${id}`, { payload });
    }

    delete(id: string): Promise<{ id: string; count: number }> {
        return this.del(`/${id}`);
    }
}
