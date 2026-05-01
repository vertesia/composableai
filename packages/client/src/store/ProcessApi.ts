import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import {
    CreateProcessDefinitionPayload,
    PublishProcessDefinitionPayload,
    ProcessDefinition,
    RevertProcessDefinitionPayload,
    UpdateProcessDefinitionPayload,
} from '@vertesia/common';

export interface ListProcessDefinitionsQuery {
    status?: string;
    process?: string;
    limit?: number;
    offset?: number;
    /** Include every revision/version instead of only the latest head revision. */
    allVersions?: boolean;
}

export class ProcessApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/processes');
    }

    list(query?: ListProcessDefinitionsQuery): Promise<ProcessDefinition[]> {
        const params: Record<string, string> = {};
        if (query?.status) params.status = query.status;
        if (query?.process) params.process = query.process;
        if (query?.limit != null) params.limit = String(query.limit);
        if (query?.offset != null) params.offset = String(query.offset);
        if (query?.allVersions) params.all_versions = 'true';
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

    listVersions(id: string): Promise<ProcessDefinition[]> {
        return this.get(`/${id}/versions`);
    }

    publish(id: string, payload: PublishProcessDefinitionPayload): Promise<ProcessDefinition> {
        return this.post(`/${id}/publish`, { payload });
    }

    revert(id: string, payload: RevertProcessDefinitionPayload): Promise<ProcessDefinition> {
        return this.post(`/${id}/revert`, { payload });
    }

    delete(id: string): Promise<{ id: string; count: number }> {
        return this.del(`/${id}`);
    }
}
