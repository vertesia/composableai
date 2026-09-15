import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateProcessDefinitionPayload,
    CreateProcessTestSuitePayload,
    ListProcessDefinitionsQuery as ListProcessDefinitionsWireQuery,
    ListProcessTestRunsQuery,
    ProcessDefinition,
    ProcessTestRun,
    ProcessTestSuite,
    PublishProcessDefinitionPayload,
    RevertProcessDefinitionPayload,
    StartProcessTestRunPayload,
    UpdateProcessDefinitionPayload,
    UpdateProcessTestSuitePayload,
} from '@vertesia/common';

export type ListProcessDefinitionsQuery = ListProcessDefinitionsWireQuery & {
    /** @deprecated Use the wire-compatible `all_versions` property. */
    allVersions?: boolean;
};

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
        if (query?.all_versions || query?.allVersions) params.all_versions = 'true';
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

    listTestSuites(processId: string): Promise<ProcessTestSuite[]> {
        return this.get(`/${processId}/test-suites`);
    }

    createTestSuite(processId: string, payload: CreateProcessTestSuitePayload): Promise<ProcessTestSuite> {
        return this.post(`/${processId}/test-suites`, { payload });
    }

    updateTestSuite(
        processId: string,
        suiteId: string,
        payload: UpdateProcessTestSuitePayload,
    ): Promise<ProcessTestSuite> {
        return this.put(`/${processId}/test-suites/${suiteId}`, { payload });
    }

    deleteTestSuite(processId: string, suiteId: string): Promise<{ id: string; count: number }> {
        return this.del(`/${processId}/test-suites/${suiteId}`);
    }

    startTestRun(processId: string, payload: StartProcessTestRunPayload): Promise<ProcessTestRun> {
        return this.post(`/${processId}/test-runs`, { payload });
    }

    listTestRuns(processId: string, query?: ListProcessTestRunsQuery): Promise<ProcessTestRun[]> {
        return this.get(`/${processId}/test-runs`, {
            query: query?.limit == null ? undefined : { limit: String(query.limit) },
        });
    }

    retrieveTestRun(processId: string, runId: string): Promise<ProcessTestRun> {
        return this.get(`/${processId}/test-runs/${runId}`);
    }

    cancelTestRun(processId: string, runId: string): Promise<ProcessTestRun> {
        return this.post(`/${processId}/test-runs/${runId}/cancel`, {});
    }
}
