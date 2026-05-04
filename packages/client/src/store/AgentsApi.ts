import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import {
    ActiveWorkstreamsQueryResult,
    AgentEvent,
    AgentArtifactUrlResponse,
    AgentMessage,
    AgentRun,
    AgentRunDetailsStreamEvent,
    AgentRunInternals,
    AgentRunResponse,
    AgentRunUpdatesResponse,
    BindRunWorkflowPayload,
    CompactMessage,
    CreateAgentRunPayload,
    CreateProcessRunPayload,
    ErrorAnalyticsResponse,
    FirstResponseBehaviorAnalyticsResponse,
    LatencyAnalyticsResponse,
    ListAgentRunsQuery,
    ListAgentRunsResponse,
    ListWorkflowRunsResponse,
    parseMessage,
    PromptSizeAnalyticsResponse,
    PostAgentRunUpdatePayload,
    PostAgentRunUpdateResponse,
    ProcessRun,
    ProcessState,
    RecordAgentRunPayload,
    RecordProcessRunPayload,
    RecordRunPayload,
    RunsByAgentAnalyticsResponse,
    SearchAgentRunsQuery,
    SearchAgentRunsResponse,
    SignalAgentPayload,
    SignalAgentResponse,
    TimeToFirstResponseAnalyticsResponse,
    TerminateAgentRunResponse,
    toAgentMessage,
    TokenUsageAnalyticsResponse,
    ToolAnalyticsResponse,
    ToolParameterAnalyticsResponse,
    TopPrincipalsAnalyticsResponse,
    UpdateAgentRunStatusPayload,
    WorkflowAnalyticsFilterOptionsResponse,
    WorkflowAnalyticsSummaryQuery,
    WorkflowAnalyticsSummaryResponse,
    WorkflowAnalyticsTimeSeriesQuery,
    WorkflowRunWithDetails,
    WorkflowToolParametersQuery,
    IngestAgentEventsPayload,
    IngestAgentEventsResponse,
} from '@vertesia/common';
import { VertesiaClient } from '../client.js';
import { EventSourceProvider } from '../execute.js';
import { shouldCloseAgentRunStream, shouldCloseCompactRunStream } from './stream-termination.js';

export class AgentsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/agents');
    }

    // ========================================================================
    // Lifecycle
    // ========================================================================

    /**
     * Create and start a new agent run.
     * Returns the created AgentRun with its stable id.
     */
    start<TData = Record<string, unknown>>(
        payload: CreateAgentRunPayload<TData>,
    ): Promise<AgentRun<TData>>;
    start<TData = Record<string, any>>(
        payload: CreateProcessRunPayload<TData>,
    ): Promise<ProcessRun>;
    start<TData = Record<string, any>>(
        payload: CreateAgentRunPayload<TData> | CreateProcessRunPayload<TData>,
    ): Promise<AgentRun<TData> | ProcessRun> {
        return this.post('/', { payload });
    }

    /**
     * Record a run for an already-running workflow. This only creates the
     * MongoDB document; the caller owns the Temporal workflow ids.
     *
     * @internal
     */
    recordRun<TData = Record<string, any>>(payload: RecordAgentRunPayload<TData>): Promise<AgentRun<TData>>;
    recordRun<TData = Record<string, any>>(payload: RecordProcessRunPayload<TData>): Promise<ProcessRun>;
    recordRun<TData = Record<string, any>>(payload: RecordRunPayload<TData>): Promise<AgentRun<TData> | ProcessRun> {
        return this.post('/record', { payload });
    }

    createRecord(payload: RecordAgentRunPayload): Promise<AgentRun> {
        return this.recordRun(payload);
    }

    /**
     * Get agent run by id.
     */
    retrieve<TData = Record<string, unknown>>(id: string): Promise<AgentRun<TData>> {
        return this.get(`/${id}`);
    }

    /**
     * Get any agent run by id, preserving the agent/process discriminator.
     */
    retrieveRun<TData = Record<string, unknown>, TProperties = Record<string, unknown>>(
        id: string,
    ): Promise<AgentRunResponse<TData, TProperties>> {
        return this.get(`/${id}`);
    }

    retrieveProcess(id: string): Promise<ProcessRun> {
        return this.get(`/${id}`);
    }

    /**
     * List agent runs with optional filters.
     */
    list(query?: ListAgentRunsQuery): Promise<ListAgentRunsResponse> {
        return this.get('/', { query: this.buildListQueryParams(query) });
    }

    async listProcessRuns(query?: Omit<ListAgentRunsQuery, 'run_kind'>): Promise<ProcessRun[]> {
        const response: ListAgentRunsResponse = await this.get('/', {
            query: this.buildListQueryParams({ ...query, run_kind: 'process' }),
        });
        return response.items.filter(isProcessRunResponse);
    }

    private buildListQueryParams(query?: ListAgentRunsQuery): Record<string, string> {
        const params: Record<string, string> = {};
        if (query?.id) params.id = query.id;
        if (query?.status) {
            params.status = Array.isArray(query.status) ? query.status.join(',') : query.status;
        }
        if (query?.interaction) params.interaction = query.interaction;
        if (query?.started_by) params.started_by = query.started_by;
        if (query?.since) params.since = query.since.toISOString();
        if (query?.until) params.until = query.until.toISOString();
        if (query?.schedule_id) params.schedule_id = query.schedule_id;
        if (query?.type) params.type = query.type;
        if (query?.run_type) params.run_type = Array.isArray(query.run_type) ? query.run_type.join(',') : query.run_type;
        if (query?.run_kind) params.run_kind = query.run_kind;
        if (query?.limit) params.limit = String(query.limit);
        if (query?.offset) params.offset = String(query.offset);
        if (query?.cursor) params.cursor = query.cursor;
        if (query?.sort) params.sort = query.sort;
        if (query?.order) params.order = query.order;
        return params;
    }

    /**
     * Search agent runs via Elasticsearch (full-text + filters).
     */
    search(query?: SearchAgentRunsQuery): Promise<SearchAgentRunsResponse> {
        const params: Record<string, string> = {};
        if (query?.query) params.query = query.query;
        if (query?.status) {
            params.status = Array.isArray(query.status) ? query.status.join(',') : query.status;
        }
        if (query?.interaction) params.interaction = query.interaction;
        if (query?.started_by) params.started_by = query.started_by;
        if (query?.categories?.length) params.categories = query.categories.join(',');
        if (query?.tags?.length) params.tags = query.tags.join(',');
        if (query?.content_type_name) params.content_type_name = query.content_type_name;
        if (query?.since) params.since = query.since.toISOString();
        if (query?.until) params.until = query.until.toISOString();
        if (query?.limit) params.limit = String(query.limit);
        if (query?.offset) params.offset = String(query.offset);
        return this.get('/search', { query: params });
    }

    /**
     * Cancel/terminate an agent run.
     */
    terminate(id: string, reason?: string): Promise<TerminateAgentRunResponse> {
        const query = reason ? { reason } : undefined;
        return this.del(`/${id}`, { query });
    }

    /**
     * Restart a completed/failed/cancelled agent run.
     * Continues the SAME AgentRun — starts a new workflow that loads
     * the conversation history from where it left off.
     * Returns the updated AgentRun (same id, status back to running).
     */
    restart(id: string): Promise<AgentRun> {
        return this.post(`/${id}/restart`, {});
    }

    /**
     * Fork a conversation into a new agent run.
     */
    fork(id: string): Promise<AgentRun> {
        return this.post(`/${id}/fork`, {});
    }

    getContext(id: string): Promise<{ run_id: string; current_node: string; context: Record<string, any> }> {
        return this.get(`/${id}/context`);
    }

    getHistory(id: string): Promise<{
        run_id: string;
        current_node: string;
        node_history: ProcessState['node_history'];
        node_history_ref?: ProcessState['node_history_ref'];
    }> {
        return this.get(`/${id}/history`);
    }

    advance(id: string, payload?: { target?: string; reason?: string }): Promise<{ message: string }> {
        return this.post(`/${id}/advance`, { payload: payload ?? {} });
    }

    retryNode(id: string, payload?: { node?: string; reason?: string }): Promise<{ message: string }> {
        return this.post(`/${id}/retry-node`, { payload: payload ?? {} });
    }

    answerTask(id: string, taskId: string, result: Record<string, any>): Promise<{ message: string }> {
        return this.post(`/${id}/answer-task`, { payload: { task_id: taskId, result } });
    }

    /**
     * Update agent run status/metadata.
     * Called by workflow activities to sync lifecycle state.
     */
    updateStatus(
        id: string,
        update: UpdateAgentRunStatusPayload,
    ): Promise<AgentRun | ProcessRun> {
        return this.post(`/${id}/status`, { payload: update });
    }

    /**
     * Attach Temporal workflow run ids to a pre-created run record.
     *
     * @internal
     */
    bindWorkflowRun(id: string, payload: BindRunWorkflowPayload): Promise<AgentRun | ProcessRun> {
        return this.post(`/${id}/workflow`, { payload });
    }

    // ========================================================================
    // Communication
    // ========================================================================

    /**
     * Send a signal to a running agent.
     * Signals: "UserInput", "Stop", "FileUploaded"
     */
    sendSignal(id: string, signalName: string, payload?: SignalAgentPayload): Promise<SignalAgentResponse> {
        return this.post(`/${id}/signal/${signalName}`, { payload });
    }

    /**
     * Query a running agent's state.
     * Queries: "ActiveWorkstreams", "AgentPlan", "AvailableTools"
     */
    query<T = unknown>(id: string, queryName: string): Promise<T> {
        return this.get(`/${id}/query/${queryName}`);
    }

    /**
     * Get active workstreams (convenience wrapper).
     */
    getActiveWorkstreams(id: string): Promise<ActiveWorkstreamsQueryResult> {
        return this.query<ActiveWorkstreamsQueryResult>(id, 'ActiveWorkstreams');
    }

    // ========================================================================
    // Messages
    // ========================================================================

    /**
     * Retrieve stored messages for an agent run.
     * Returns gzip-compressed responses for large payloads.
     */
    async retrieveMessages(id: string, since?: number): Promise<AgentMessage[]> {
        const query = since ? { since } : undefined;
        const response = await this.get(`/${id}/updates`, { query }) as AgentRunUpdatesResponse;
        return response.messages.map((m: CompactMessage) => toAgentMessage(m, id));
    }

    /**
     * Post a message/update to an agent run.
     */
    postMessage(id: string, msg: PostAgentRunUpdatePayload): Promise<PostAgentRunUpdateResponse> {
        return this.post(`/${id}/updates`, { payload: msg });
    }

    // ========================================================================
    // Streaming
    // ========================================================================

    /**
     * Stream messages via SSE. Returns a promise that resolves on stream end.
     *
     * Fetches historical messages via GET /updates (gzip-compressed),
     * then connects to SSE for real-time updates only.
     */
    async streamMessages(
        id: string,
        onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
        since?: number,
        signal?: AbortSignal,
    ): Promise<unknown> {
        let resolveFn: (value: unknown) => void = () => {};
        let rejectFn: (reason?: unknown) => void = () => {};
        const promise = new Promise<unknown>((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });

        let reconnectAttempts = 0;
        let lastMessageTimestamp = since || 0;
        let isClosed = false;
        let currentSse: EventSource | null = null;
        let interval: ReturnType<typeof setInterval> | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let abortHandler: (() => void) | null = null;

        const maxReconnectAttempts = 10;
        const baseDelay = 1000;
        const maxDelay = 30000;

        const calculateBackoffDelay = (attempts: number): number => {
            const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
            const jitter = Math.random() * 0.1 * exponentialDelay;
            return exponentialDelay + jitter;
        };

        const cleanup = () => {
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            if (interval) { clearInterval(interval); interval = null; }
            if (currentSse) { currentSse.close(); currentSse = null; }
            if (signal && abortHandler) { signal.removeEventListener('abort', abortHandler); abortHandler = null; }
        };

        const exit = (payload: unknown) => {
            if (!isClosed) {
                isClosed = true;
                cleanup();
                resolveFn(payload);
            }
        };

        if (signal) {
            if (signal.aborted) { isClosed = true; cleanup(); resolveFn(null); return promise; }
            abortHandler = () => { exit(null); };
            signal.addEventListener('abort', abortHandler, { once: true });
        }

        // 1. Fetch historical messages via GET /updates (gzip-compressed)
        try {
            if (!isClosed) {
                const historical = await this.retrieveMessages(id, since);
                for (const msg of historical) {
                    if (isClosed) break;
                    lastMessageTimestamp = Math.max(lastMessageTimestamp, msg.timestamp || 0);
                    if (onMessage) onMessage(msg, exit);
                    if (isClosed) break;

                    if (shouldCloseAgentRunStream(msg, id)) {
                        exit(null);
                        return promise;
                    }
                }
            }
        } catch (err) {
            if (!isClosed) {
                console.warn('Failed to fetch historical messages, continuing with SSE:', err);
            }
        }

        // 2. Connect to SSE for real-time updates
        const setupStream = async (isReconnect: boolean = false) => {
            if (isClosed) return;
            try {
                const EventSourceImpl = await EventSourceProvider();
                if (isClosed) return;
                const client = this.client as VertesiaClient;
                const streamUrl = new URL(client.agents.baseUrl + `/${id}/stream`);

                if (lastMessageTimestamp > 0) {
                    streamUrl.searchParams.set('since', lastMessageTimestamp.toString());
                }
                streamUrl.searchParams.set('skipHistory', 'true');

                const bearerToken = client._auth ? await client._auth() : undefined;
                if (isClosed) return;
                if (!bearerToken) {
                    isClosed = true;
                    cleanup();
                    rejectFn(new Error('No auth token available'));
                    return;
                }

                const token = bearerToken.split(' ')[1];
                streamUrl.searchParams.set('access_token', token);

                if (isReconnect) {
                    console.log(`Reconnecting to agent stream ${id} (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
                }

                if (isClosed) return;
                const sse = new EventSourceImpl(streamUrl.href);
                currentSse = sse;
                interval = setInterval(() => { }, 1000);

                let connectionOpenedAt = 0;

                sse.onopen = () => {
                    if (isReconnect) console.log(`Reconnected to agent stream ${id}`);
                    connectionOpenedAt = Date.now();
                };

                sse.onmessage = (ev: MessageEvent) => {
                    if (isClosed) return;
                    if (!ev.data || ev.data.startsWith(':')) return;

                    try {
                        const compactMessage = parseMessage(ev.data);
                        if (compactMessage.ts) {
                            lastMessageTimestamp = Math.max(lastMessageTimestamp, compactMessage.ts);
                        } else {
                            lastMessageTimestamp = Date.now();
                        }

                        if (onMessage) {
                            const agentMessage = toAgentMessage(compactMessage, id);
                            onMessage(agentMessage, exit);
                        }

                        if (shouldCloseCompactRunStream(compactMessage, id)) {
                            exit(null);
                        }
                    } catch (err) {
                        console.error('Failed to parse SSE message:', err, ev.data);
                    }
                };

                sse.onerror = (_err: unknown) => {
                    if (isClosed) return;
                    cleanup();

                    // Only reset reconnect attempts if the connection was stable
                    // for at least 5 seconds. This prevents infinite rapid polling
                    // when the connection opens (200) but drops immediately (e.g.
                    // proxy/load-balancer timeout).
                    const connectionDuration = connectionOpenedAt ? Date.now() - connectionOpenedAt : 0;
                    if (connectionDuration > 5000) {
                        reconnectAttempts = 0;
                    }

                    if (reconnectAttempts < maxReconnectAttempts) {
                        const delay = calculateBackoffDelay(reconnectAttempts);
                        reconnectAttempts++;
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            if (!isClosed) setupStream(true);
                        }, delay);
                    } else {
                        isClosed = true;
                        cleanup();
                        rejectFn(new Error(`SSE connection failed after ${maxReconnectAttempts} reconnection attempts`));
                    }
                };
            } catch (err) {
                if (isClosed) return;
                if (reconnectAttempts < maxReconnectAttempts) {
                    const delay = calculateBackoffDelay(reconnectAttempts);
                    reconnectAttempts++;
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        if (!isClosed) setupStream(true);
                    }, delay);
                } else {
                    isClosed = true;
                    cleanup();
                    rejectFn(err);
                }
            }
        };

        setupStream(false);
        return promise;
    }

    // ========================================================================
    // Observability
    // ========================================================================

    /**
     * Get internal/Temporal details for an agent run.
     * Returns fields normally stripped from client responses (workflow IDs, artifacts path).
     */
    getInternals(id: string): Promise<AgentRunInternals> {
        return this.get(`/${id}/internals`);
    }

    /**
     * Get detailed workflow run information for an agent run.
     * The server resolves Temporal IDs internally.
     */
    getRunDetails(
        id: string,
        options?: {
            includeHistory?: boolean;
        },
    ): Promise<WorkflowRunWithDetails> {
        const query: Record<string, string> = {};
        if (options?.includeHistory) query.include_history = 'true';
        return this.get(`/${id}/details`, { query });
    }

    /**
     * Stream Temporal history events via SSE (handles continueAsNew).
     * Returns an EventSource that emits 'history' and 'control' events.
     */
    async streamRunDetails(
        id: string,
        onEvent?: (event: AgentRunDetailsStreamEvent) => void,
        signal?: AbortSignal,
    ): Promise<void> {
        const EventSourceImpl = await EventSourceProvider();
        const client = this.client as VertesiaClient;
        const streamUrl = new URL(client.agents.baseUrl + `/${id}/details/stream`);

        const bearerToken = client._auth ? await client._auth() : undefined;
        if (!bearerToken) {
            throw new Error('No auth token available');
        }
        const token = bearerToken.split(' ')[1];
        streamUrl.searchParams.set('access_token', token);

        return new Promise<void>((resolve, reject) => {
            const sse = new EventSourceImpl(streamUrl.href);
            let abortHandler: (() => void) | null = null;

            const cleanup = () => {
                sse.close();
                if (signal && abortHandler) {
                    signal.removeEventListener('abort', abortHandler);
                    abortHandler = null;
                }
            };

            if (signal) {
                if (signal.aborted) { cleanup(); resolve(); return; }
                abortHandler = () => { cleanup(); resolve(); };
                signal.addEventListener('abort', abortHandler, { once: true });
            }

            sse.addEventListener('history', (ev: MessageEvent) => {
                try {
                    const data = JSON.parse(ev.data) as Extract<AgentRunDetailsStreamEvent, { type: 'history' }>['data'];
                    if (onEvent) onEvent({ type: 'history', data });
                } catch (_err) { /* ignore parse errors */ }
            });

            sse.addEventListener('control', (ev: MessageEvent) => {
                try {
                    const data = JSON.parse(ev.data) as Extract<AgentRunDetailsStreamEvent, { type: 'control' }>['data'];
                    if (onEvent) onEvent({ type: 'control', data });
                    if ('type' in data && data.type === 'done') {
                        cleanup();
                        resolve();
                    }
                } catch (_err) { /* ignore parse errors */ }
            });

            sse.addEventListener('error', (ev: MessageEvent) => {
                try {
                    const data = JSON.parse(ev.data) as Extract<AgentRunDetailsStreamEvent, { type: 'error' }>['data'];
                    if (onEvent) onEvent({ type: 'error', data });
                } catch (_err) { /* ignore parse errors */ }
            });

            sse.onerror = (_err: unknown) => {
                cleanup();
                reject(new Error('SSE connection failed for details stream'));
            };
        });
    }

    /**
     * List child workflows for an agent or process run.
     */
    listChildren(id: string): Promise<ListWorkflowRunsResponse> {
        return this.get(`/${id}/children`);
    }

    /**
     * Get details for a specific child workflow.
     * Serves from the child run record when available, falls back to archive or Temporal.
     */
    getChildDetails(
        id: string,
        childWorkflowId: string,
        options?: { includeHistory?: boolean },
    ): Promise<WorkflowRunWithDetails> {
        const query: Record<string, string> = {};
        if (options?.includeHistory) query.include_history = 'true';
        return this.get(`/${id}/children/${childWorkflowId}/details`, { query });
    }

    // ========================================================================
    // Artifacts
    // ========================================================================

    /**
     * List artifacts for an agent run.
     * visibility:
     * - 'user' (default): only user-facing artifacts
     * - 'internal': only system-managed state files such as conversation snapshots
     * - 'all': both user-facing and internal files
     */
    listArtifacts(id: string, options?: { visibility?: 'user' | 'internal' | 'all' }): Promise<string[]> {
        const query = options?.visibility ? { visibility: options.visibility } : undefined;
        return this.get(`/${id}/artifacts`, { query });
    }

    /**
     * Get a signed download URL for an artifact.
     */
    getArtifactUrl(
        id: string,
        path: string,
        disposition?: 'inline' | 'attachment',
        fileName?: string,
    ): Promise<AgentArtifactUrlResponse> {
        const query: Record<string, string> = { url: '1' };
        if (disposition) query.disposition = disposition;
        if (fileName) query.filename = fileName;
        return this.get(`/${id}/artifacts/${path}`, { query });
    }

    /**
     * Upload an artifact to an agent run.
     * Works even before the workflow has started (pre-upload).
     *
     * 1. Gets a signed upload URL from the server
     * 2. Uploads the content directly to cloud storage
     *
     * @returns The full storage path of the uploaded artifact.
     */
    async uploadArtifact(
        id: string,
        path: string,
        content: Blob | ReadableStream | ArrayBuffer | string,
        contentType?: string,
    ): Promise<AgentArtifactUrlResponse> {
        const mimeType = contentType || 'application/octet-stream';

        // 1. Get signed upload URL from the agents API
        const result = await this.put(`/${id}/artifacts/${path}`, {
            headers: { 'Content-Type': mimeType },
        }) as AgentArtifactUrlResponse;

        // 2. Upload directly to cloud storage
        const res = await fetch(result.url, {
            method: 'PUT',
            body: content,
            headers: { 'Content-Type': mimeType },
        });

        if (!res.ok) {
            throw new Error(`Failed to upload artifact: ${res.statusText}`);
        }

        return result;
    }

    /**
     * Download an artifact from an agent run.
     */
    async downloadArtifact(
        id: string,
        path: string,
    ): Promise<ReadableStream<Uint8Array>> {
        const { url } = await this.getArtifactUrl(id, path, 'attachment');
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to download artifact: ${res.statusText}`);
        }
        if (!res.body) {
            throw new Error('No body in artifact download response');
        }
        return res.body;
    }

    // ========================================================================
    // Telemetry ingestion
    // ========================================================================

    /**
     * Ingest telemetry events for an agent run.
     * Workers use this to send telemetry to zeno-server for BigQuery storage.
     */
    ingestEvents(
        agentRunId: string,
        events: AgentEvent[],
    ): Promise<IngestAgentEventsResponse> {
        const payload: IngestAgentEventsPayload = { events };
        return this.post(`/${agentRunId}/events`, { payload });
    }

    // ========================================================================
    // Analytics
    // ========================================================================

    /**
     * Get analytics summary.
     * Returns overall metrics including token usage, success rates, and run counts.
     */
    getAnalyticsSummary(
        query: WorkflowAnalyticsSummaryQuery = {}
    ): Promise<WorkflowAnalyticsSummaryResponse> {
        return this.post('/analytics/summary', { payload: query });
    }

    /**
     * Get token usage analytics.
     * Returns token consumption metrics by model, agent, tool, or over time.
     */
    getTokenUsageAnalytics(
        query: WorkflowAnalyticsTimeSeriesQuery = {}
    ): Promise<TokenUsageAnalyticsResponse> {
        return this.post('/analytics/tokens', { payload: query });
    }

    /**
     * Get LLM latency analytics.
     * Returns duration/latency metrics for LLM calls.
     */
    getLlmLatencyAnalytics(
        query: WorkflowAnalyticsTimeSeriesQuery = {}
    ): Promise<LatencyAnalyticsResponse> {
        return this.post('/analytics/latency/llm', { payload: query });
    }

    /**
     * Get tool latency analytics.
     * Returns duration/latency metrics for tool calls.
     */
    getToolLatencyAnalytics(
        query: WorkflowAnalyticsTimeSeriesQuery = {}
    ): Promise<LatencyAnalyticsResponse> {
        return this.post('/analytics/latency/tools', { payload: query });
    }

    /**
     * Get agent latency analytics.
     * Returns duration metrics for complete agent runs.
     */
    getAgentLatencyAnalytics(
        query: WorkflowAnalyticsTimeSeriesQuery = {}
    ): Promise<LatencyAnalyticsResponse> {
        return this.post('/analytics/latency/agents', { payload: query });
    }

    /**
     * Get error analytics.
     * Returns error rates, types, and trends.
     */
    getErrorAnalytics(
        query: WorkflowAnalyticsTimeSeriesQuery = {}
    ): Promise<ErrorAnalyticsResponse> {
        return this.post('/analytics/errors', { payload: query });
    }

    /**
     * Get tool usage analytics.
     * Returns tool invocation counts, success rates, and performance metrics.
     */
    getToolAnalytics(
        query: WorkflowAnalyticsSummaryQuery = {}
    ): Promise<ToolAnalyticsResponse> {
        return this.post('/analytics/tools', { payload: query });
    }

    /**
     * Get tool parameter analytics.
     * Returns parameter value distributions for a specific tool.
     */
    getToolParameterAnalytics(
        query: WorkflowToolParametersQuery
    ): Promise<ToolParameterAnalyticsResponse> {
        return this.post('/analytics/tools/parameters', { payload: query });
    }

    /**
     * Get available filter options for analytics.
     * Returns unique agents, environments, and models from telemetry data.
     */
    getAnalyticsFilterOptions(
        query: WorkflowAnalyticsSummaryQuery = {}
    ): Promise<WorkflowAnalyticsFilterOptionsResponse> {
        return this.post('/analytics/filter-options', { payload: query });
    }

    /**
     * Get average prompt size (input tokens) by agent for startConversation calls.
     * This represents the initial prompt + tools size.
     */
    getPromptSizeAnalytics(
        query: WorkflowAnalyticsSummaryQuery = {}
    ): Promise<PromptSizeAnalyticsResponse> {
        return this.post('/analytics/prompt-size', { payload: query });
    }

    /**
     * Get top principals (users/API keys) who started the most agent runs.
     * Returns the top N principals sorted by run count descending.
     */
    getTopPrincipalsAnalytics(
        query: WorkflowAnalyticsSummaryQuery = {}
    ): Promise<TopPrincipalsAnalyticsResponse> {
        return this.post('/analytics/top-principals', { payload: query });
    }

    /**
     * Get agent run distribution - how many runs per agent/interaction type.
     * Returns the top N agents sorted by run count descending.
     */
    getRunsByAgentAnalytics(
        query: WorkflowAnalyticsSummaryQuery = {}
    ): Promise<RunsByAgentAnalyticsResponse> {
        return this.post('/analytics/runs-by-agent', { payload: query });
    }

    /**
     * Get time to first response analytics.
     * Measures the time from agent start to the completion of the first LLM call.
     * Returns average, min, max, median, p95, and p99 metrics.
     */
    getTimeToFirstResponseAnalytics(
        query: WorkflowAnalyticsTimeSeriesQuery = {}
    ): Promise<TimeToFirstResponseAnalyticsResponse> {
        return this.post('/analytics/time-to-first-response', { payload: query });
    }

    /**
     * Get first response behavior analytics.
     * Analyzes the agent's first LLM response behavior:
     * - Percentage of agents that start by making a plan
     * - Percentage of agents that return no tool calls at start
     */
    getFirstResponseBehaviorAnalytics(
        query: WorkflowAnalyticsTimeSeriesQuery = {}
    ): Promise<FirstResponseBehaviorAnalyticsResponse> {
        return this.post('/analytics/first-response-behavior', { payload: query });
    }

}

function isProcessRunResponse(run: AgentRunResponse): run is ProcessRun {
    return run.run_kind === 'process';
}
