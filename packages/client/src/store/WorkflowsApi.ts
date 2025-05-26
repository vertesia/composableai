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

    sendSignal(workflowId: string, runId: string, signal: string, payload?: any): Promise<{ message: string }> {
        return this.post(`/runs/${workflowId}/${runId}/signal/${signal}`, { payload });
    }

    getRunDetails(runId: string, workflowId: string): Promise<WorkflowRunWithDetails> {
        return this.get(`/runs/${workflowId}/${runId}`);
    }

    terminate(workflowId: string, runId: string, reason?: string): Promise<{ message: string }> {
        return this.post(`/runs/${workflowId}/${runId}/actions/terminate`, { payload: { reason } });
    }

    cancel(workflowId: string, runId: string, reason?: string): Promise<{ message: string }> {
        return this.post(`/runs/${workflowId}/${runId}/actions/cancel`, { payload: { reason } });
    }

    execute(
        name: string,
        payload: ExecuteWorkflowPayload = {},
    ): Promise<({ run_id: string; workflow_id: string } | undefined)[]> {
        return this.post(`/execute/${name}`, { payload });
    }

    postMessage(runId: string, msg: AgentMessage): Promise<void> {
        if (!runId) {
            throw new Error("runId is required");
        }
        return this.post(`/runs/${runId}/updates`, { payload: msg });
    }

    retrieveMessages(runId: string, since?: number): Promise<AgentMessage[]> {
        const query = {
            since,
        };
        return this.get(`/runs/${runId}/updates`, { query });
    }

    async streamMessages(runId: string, onMessage?: (message: AgentMessage) => void, since?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            let reconnectAttempts = 0;
            let lastMessageTimestamp = since || 0;
            let isClosed = false;
            let currentSse: EventSource | null = null;
            let interval: NodeJS.Timeout | null = null;

            const maxReconnectAttempts = 10;
            const baseDelay = 1000; // 1 second base delay
            const maxDelay = 30000; // 30 seconds max delay

            const calculateBackoffDelay = (attempts: number): number => {
                const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
                // Add jitter to prevent thundering herd
                const jitter = Math.random() * 0.1 * exponentialDelay;
                return exponentialDelay + jitter;
            };

            const cleanup = () => {
                if (interval) {
                    clearInterval(interval);
                    interval = null;
                }
                if (currentSse) {
                    currentSse.close();
                    currentSse = null;
                }
            };

            const setupStream = async (isReconnect: boolean = false) => {
                if (isClosed) return;

                try {
                    const EventSourceImpl = await EventSourceProvider();
                    const client = this.client as VertesiaClient;
                    const streamUrl = new URL(client.workflows.baseUrl + "/runs/" + runId + "/stream");
    
                    // Use the timestamp of the last received message for reconnection
                    if (lastMessageTimestamp > 0) {
                        streamUrl.searchParams.set("since", lastMessageTimestamp.toString());
                    }
    
                    const bearerToken = client._auth ? await client._auth() : undefined;
                    if (!bearerToken) {
                        reject(new Error("No auth token available"));
                        return;
                    }
    
                    const token = bearerToken.split(" ")[1];
                    streamUrl.searchParams.set("access_token", token);

                    if (isReconnect) {
                        console.log(`Reconnecting to SSE stream for run ${runId} (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
                    }
    
                    const sse = new EventSourceImpl(streamUrl.href);
                    currentSse = sse;
    
                    // Prevent Node from exiting prematurely
                    interval = setInterval(() => {}, 1000);
    
                    sse.onopen = () => {
                        if (isReconnect) {
                            console.log(`Successfully reconnected to SSE stream for run ${runId}`);
                        }
                        // Reset reconnect attempts on successful connection
                        reconnectAttempts = 0;
                    };

                    sse.onmessage = (ev: MessageEvent) => {
                        if (!ev.data || ev.data.startsWith(":")) {
                            console.log("Received comment or heartbeat; ignoring it.: ", ev.data);
                            return;
                        }
    
                        try {
                            const message = JSON.parse(ev.data) as AgentMessage;
                            
                            // Update last message timestamp for reconnection
                            if (message.timestamp) {
                                lastMessageTimestamp = Math.max(lastMessageTimestamp, message.timestamp);
                            }

                            if (onMessage) onMessage(message);
    
                            // Only close the stream when the main workstream completes
                            if (message.type === AgentMessageType.COMPLETE && (!message.workstream_id || message.workstream_id === 'main')) {
                                console.log("Closing stream due to COMPLETE message from main workstream");
                                if (!isClosed) {
                                    isClosed = true;
                                    cleanup();
                                    resolve();
                                }
                            } else if (message.type === AgentMessageType.COMPLETE) {
                                console.log(`Received COMPLETE message from non-main workstream: ${message.workstream_id || 'unknown'}, keeping stream open`);
                            }
                        } catch (err) {
                            console.error("Failed to parse SSE message:", err, ev.data);
                        }
                    };
    
                    sse.onerror = (err: any) => {
                        if (isClosed) return;

                        console.warn(`SSE stream error for run ${runId}:`, err);
                        cleanup();

                        // Check if we should attempt reconnection
                        if (reconnectAttempts < maxReconnectAttempts) {
                            const delay = calculateBackoffDelay(reconnectAttempts);
                            console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
                            
                            reconnectAttempts++;
                            setTimeout(() => {
                                if (!isClosed) {
                                    setupStream(true);
                                }
                            }, delay);
                        } else {
                            console.error(`Failed to reconnect to SSE stream for run ${runId} after ${maxReconnectAttempts} attempts`);
                            isClosed = true;
                            reject(new Error(`SSE connection failed after ${maxReconnectAttempts} reconnection attempts`));
                        }
                    };
                } catch (err) {
                    console.error("Error setting up SSE stream:", err);
                    if (reconnectAttempts < maxReconnectAttempts) {
                        const delay = calculateBackoffDelay(reconnectAttempts);
                        reconnectAttempts++;
                        setTimeout(() => {
                            if (!isClosed) {
                                setupStream(true);
                            }
                        }, delay);
                    } else {
                        reject(err);
                    }
                }
            };
            
            // Start the async setup process
            setupStream(false);

            // Return cleanup function for external cancellation
            return () => {
                isClosed = true;
                cleanup();
            };
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

    execute(
        id: string,
        objectIds?: string[],
        vars?: Record<string, any>,
    ): Promise<({ run_id: string; workflow_id: string } | undefined)[]> {
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
