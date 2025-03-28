import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    ActivityCatalog,
    AgentMessage,
    AgentMessageType,
    CreateWorkflowRulePayload,
    DSLWorkflowDefinition,
    DSLWorkflowSpec,
    ExecuteWorkflowPayload,
    ListWorkflowRunsPayload,
    ListWorkflowRunsResponse,
    WorkflowDefinitionRef,
    WorkflowRule,
    WorkflowRuleItem,
    WorkflowRunWithDetails,
} from "@vertesia/common";
import { VertesiaClient } from "../client.js";
import { EventSourceProvider } from "../execute.js";

export class WorkflowsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/workflows");
    }

    getActivityCatalog(): Promise<ActivityCatalog> {
        return this.get("/activity-catalog");
    }

    listRuns(documentId: string, eventName: string, ruleId: string): Promise<ListWorkflowRunsResponse> {
        return this.post(`/runs`, { payload: { documentId, eventName, ruleId } });
    }

    searchRuns(payload: ListWorkflowRunsPayload): Promise<ListWorkflowRunsResponse> {
        return this.post(`/runs`, { payload: payload });
    }

    getRunDetails(runId: string, workflowId: string): Promise<WorkflowRunWithDetails> {
        return this.get(`/runs/${workflowId}/${runId}`, { query: { workflowId } });
    }

    terminate(workflowId: string, runId: string, reason?: string): Promise<{ message: string }> {
        return this.post(`/runs/${workflowId}/${runId}/terminate`, { payload: { reason } });
    }

    cancel(workflowId: string, runId: string, reason?: string): Promise<{ message: string }> {
        return this.post(`/runs/${workflowId}/${runId}/cancel`, { payload: { reason } });
    }

    execute(name: string, payload: ExecuteWorkflowPayload = {}): Promise<{ runIds: string[] }> {
        return this.post(`/execute/${name}`, { payload });
    }

    postMessage(runId: string, message: string, type?: AgentMessageType): Promise<void> {
        const payload = {
            message,
            type,
        };
        return this.post(`/runs/${runId}/updates`, { payload });
    }

    retrieveMessages(runId: string, since?: number): Promise<AgentMessage[]> {
        const query = {
            since,
        };
        return this.get(`/runs/${runId}/updates`, { query });
    }

    streamMessages(
        runId: string,
        onMessage?: (message: AgentMessage) => void,
        since?: number,
    ): Promise<string | undefined> {
        return new Promise(async (resolve, reject) => {
            try {
                const EventSourceImpl = await EventSourceProvider();
                const client = this.client as VertesiaClient;
                const streamUrl = new URL(client.workflows + "/" + runId + "/stream");
                if (since) {
                    streamUrl.searchParams.set("since", since.toString());
                }
                const bearerToken = client._auth ? await client._auth() : undefined;

                if (bearerToken) {
                    const token = bearerToken.split(" ")[1];
                    streamUrl.searchParams.set("access_token", token);
                } else {
                    throw new Error("No auth token available");
                }

                const sse = new EventSourceImpl(streamUrl.href);
                sse.addEventListener("message", (ev) => {
                    try {
                        const message = JSON.parse(ev.data) as AgentMessage;
                        if (message) {
                            onMessage && onMessage(message);
                        }
                    } catch (err) {
                        reject(err);
                    }
                });
                sse.addEventListener("close", (ev) => {
                    try {
                        sse.close();
                        const msg = JSON.parse(ev.data) as AgentMessage;
                        resolve(msg.content);
                    } catch (err) {
                        reject(err);
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    rules = new WorkflowsRulesApi(this);
    definitions = new WorkflowsDefinitionApi(this);
}

export class WorkflowsRulesApi extends ApiTopic {
    constructor(parent: WorkflowsApi) {
        super(parent, "/rules");
    }

    list(): Promise<WorkflowRuleItem[]> {
        return this.get("/");
    }

    retrieve(id: string): Promise<WorkflowRule> {
        return this.get(`/${id}`);
    }

    update(id: string, payload: any): Promise<WorkflowRule> {
        return this.put(`/${id}`, {
            payload,
        });
    }

    create(payload: CreateWorkflowRulePayload): Promise<WorkflowRule> {
        return this.post("/", {
            payload,
        });
    }

    delete(id: string) {
        return this.del(`/${id}`);
    }

    execute(id: string, objectIds?: string[], vars?: Record<string, any>): Promise<{ runIds: string[] }> {
        const payload: ExecuteWorkflowPayload = {
            objectIds,
            vars,
        };
        return this.post(`/${id}/execute`, { payload });
    }
}

export class WorkflowsDefinitionApi extends ApiTopic {
    //model: DSLWorkflowDefinition;

    constructor(parent: WorkflowsApi) {
        super(parent, "/definitions");
    }

    list(): Promise<WorkflowDefinitionRef[]> {
        return this.get("/");
    }

    retrieve(id: string): Promise<DSLWorkflowDefinition> {
        return this.get(`/${id}`);
    }

    update(id: string, payload: any): Promise<DSLWorkflowDefinition> {
        return this.put(`/${id}`, {
            payload,
        });
    }

    create(payload: DSLWorkflowSpec): Promise<DSLWorkflowDefinition> {
        return this.post("/", {
            payload,
        });
    }

    delete(id: string) {
        return this.del(`/${id}`);
    }
}
