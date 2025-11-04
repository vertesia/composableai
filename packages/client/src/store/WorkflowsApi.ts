import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    ActivityCatalog,
    AgentMessage,
    AgentMessageType,
    CreateWorkflowRulePayload,
    DSLWorkflowDefinition,
    DSLWorkflowSpec,
    ExecuteWorkflowPayload,
    ListWorkflowInteractionsResponse,
    ListWorkflowRunsPayload,
    ListWorkflowRunsResponse,
    WebSocketClientMessage,
    WebSocketServerMessage,
    WorkflowActionPayload,
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

    /** List conversations the users has access to */
    listConversations(payload: ListWorkflowRunsPayload): Promise<ListWorkflowRunsResponse> {
        return this.post(`/conversations`, {
            payload
        });
    }

    searchRuns(payload: ListWorkflowRunsPayload): Promise<ListWorkflowRunsResponse> {
        return this.post(`/runs`, { payload: payload });
    }

    sendSignal(workflowId: string, runId: string, signal: string, payload?: any): Promise<{ message: string }> {
        return this.post(`/runs/${workflowId}/${runId}/signal/${signal}`, { payload });
    }

    getRunDetails(runId: string, workflowId: string, includeHistory: boolean = false): Promise<WorkflowRunWithDetails> {
        const query = { include_history: includeHistory };
        return this.get(`/runs/${workflowId}/${runId}`, { query });
    }

    getRunInteraction(workflowId: string, runId: string): Promise<ListWorkflowInteractionsResponse> {
        return this.get(`/runs/${workflowId}/${runId}/interaction`);
    }

    terminate(workflowId: string, runId: string, reason?: string): Promise<{ message: string }> {
        const payload: WorkflowActionPayload = { reason };
        return this.post(`/runs/${workflowId}/${runId}/actions/terminate`, { payload });
    }

    cancel(workflowId: string, runId: string, reason?: string): Promise<{ message: string }> {
        const payload: WorkflowActionPayload = { reason };
        return this.post(`/runs/${workflowId}/${runId}/actions/cancel`, { payload });
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

    retrieveMessages(workflowId: string, runId: string, since?: number): Promise<AgentMessage[]> {
        const query = {
            since,
        };
        return this.get(`/runs/${workflowId}/${runId}/updates`, { query });
    }

    async streamMessages(workflowId: string, runId: string, onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void, since?: number): Promise<unknown> {
        return new Promise<unknown>((resolve, reject) => {
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

            const exit = (payload: unknown) => {
                if (!isClosed) {
                    isClosed = true;
                    cleanup();
                    resolve(payload);
                }
            };

            const setupStream = async (isReconnect: boolean = false) => {
                if (isClosed) return;

                try {
                    const EventSourceImpl = await EventSourceProvider();
                    const client = this.client as VertesiaClient;
                    const streamUrl = new URL(client.workflows.baseUrl + `/runs/${workflowId}/${runId}/stream`);

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
                    interval = setInterval(() => { }, 1000);

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

                            if (onMessage) onMessage(message, exit);

                            const streamIsOver = message.type === AgentMessageType.TERMINATED ||
                                (message.type === AgentMessageType.COMPLETE &&
                                    (!message.workstream_id || message.workstream_id === 'main'));

                            // Only close the stream when the main workstream completes or terminates
                            if (streamIsOver) {
                                console.log("Closing stream due to COMPLETE message from main workstream");
                                if (!isClosed) {
                                    isClosed = true;
                                    cleanup();
                                    resolve(null);
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

    /**
     * Stream workflow messages via WebSocket (for mobile/React Native clients)
     * @param workflowId The workflow ID
     * @param runId The run ID
     * @param onMessage Callback for incoming messages
     * @param since Optional timestamp to resume from
     * @returns Promise that resolves with cleanup function and sendSignal helper
     */
    async streamMessagesWS(
        workflowId: string,
        runId: string,
        onMessage?: (message: AgentMessage) => void,
        since?: number
    ): Promise<{ cleanup: () => void; sendSignal: (signalName: string, data: any) => void }> {
        return new Promise((resolve, reject) => {
            let reconnectAttempts = 0;
            const maxReconnectAttempts = 10;
            const baseDelay = 1000;
            const maxDelay = 30000;
            let ws: WebSocket | null = null;
            let lastMessageTimestamp = since || 0;
            let isClosed = false;

            const calculateBackoffDelay = (attempts: number): number => {
                const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
                const jitter = Math.random() * 0.1 * exponentialDelay;
                return exponentialDelay + jitter;
            };

            const connect = async () => {
                if (isClosed) return;

                try {
                    const client = this.client as VertesiaClient;
                    const wsUrl = new URL(client.workflows.baseUrl + `/runs/${workflowId}/${runId}/ws`);

                    // Replace http/https with ws/wss
                    wsUrl.protocol = wsUrl.protocol.replace('http', 'ws');

                    // Add query parameters
                    if (lastMessageTimestamp > 0) {
                        wsUrl.searchParams.set('since', lastMessageTimestamp.toString());
                    }

                    const bearerToken = client._auth ? await client._auth() : undefined;
                    if (!bearerToken) {
                        reject(new Error('No auth token available'));
                        return;
                    }

                    const token = bearerToken.split(' ')[1];
                    wsUrl.searchParams.set('access_token', token);

                    if (reconnectAttempts > 0) {
                        console.log(`Reconnecting to WebSocket for run ${runId} (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
                    }

                    ws = new WebSocket(wsUrl.href);

                    ws.onopen = () => {
                        if (reconnectAttempts > 0) {
                            console.log(`Successfully reconnected to WebSocket for run ${runId}`);
                        }
                        reconnectAttempts = 0;

                        // Resolve with helpers on first successful connection
                        if (!isClosed) {
                            resolve({
                                cleanup: () => {
                                    isClosed = true;
                                    if (ws) {
                                        ws.close();
                                        ws = null;
                                    }
                                },
                                sendSignal: (signalName: string, data: any) => {
                                    if (ws?.readyState === WebSocket.OPEN) {
                                        const message: WebSocketClientMessage = {
                                            type: 'signal',
                                            signalName,
                                            data,
                                            requestId: Date.now()
                                        };
                                        ws.send(JSON.stringify(message));
                                    } else {
                                        console.warn('WebSocket not open, cannot send signal');
                                    }
                                }
                            });
                        }
                    };

                    ws.onmessage = (event: MessageEvent) => {
                        try {
                            const message = JSON.parse(event.data) as WebSocketServerMessage;

                            // Handle different message types
                            if ('workflow_run_id' in message) {
                                // This is an AgentMessage
                                const agentMessage = message as AgentMessage;

                                if (agentMessage.timestamp) {
                                    lastMessageTimestamp = Math.max(lastMessageTimestamp, agentMessage.timestamp);
                                }

                                if (onMessage) onMessage(agentMessage);

                                // Check for stream completion
                                const streamIsOver =
                                    agentMessage.type === AgentMessageType.TERMINATED ||
                                    (agentMessage.type === AgentMessageType.COMPLETE &&
                                        (!agentMessage.workstream_id || agentMessage.workstream_id === 'main'));

                                if (streamIsOver) {
                                    console.log('Closing WebSocket due to workflow completion');
                                    isClosed = true;
                                    if (ws) {
                                        ws.close();
                                        ws = null;
                                    }
                                }
                            } else if (message.type === 'pong') {
                                // Heartbeat response
                                console.debug('Received pong');
                            } else if (message.type === 'ack') {
                                console.debug('Signal acknowledged', message);
                            } else if (message.type === 'error') {
                                console.error('WebSocket error message', message);
                            }
                        } catch (err) {
                            console.error('Failed to parse WebSocket message', err);
                        }
                    };

                    ws.onerror = (err) => {
                        console.error('WebSocket error', err);
                    };

                    ws.onclose = () => {
                        if (!isClosed && reconnectAttempts < maxReconnectAttempts) {
                            const delay = calculateBackoffDelay(reconnectAttempts);
                            console.log(`WebSocket closed, reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
                            reconnectAttempts++;
                            setTimeout(connect, delay);
                        } else if (reconnectAttempts >= maxReconnectAttempts) {
                            reject(new Error(`WebSocket connection failed after ${maxReconnectAttempts} attempts`));
                        }
                    };
                } catch (err) {
                    console.error('Error setting up WebSocket', err);
                    if (reconnectAttempts < maxReconnectAttempts) {
                        const delay = calculateBackoffDelay(reconnectAttempts);
                        reconnectAttempts++;
                        setTimeout(connect, delay);
                    } else {
                        reject(err);
                    }
                }
            };

            connect();
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
