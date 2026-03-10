import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import {
    ActiveWorkstreamsQueryResult,
    AgentMessage,
    AgentMessageType,
    AgentRun,
    AgentRunInternals,
    AgentRunStatus,
    CompactMessage,
    CreateAgentRunPayload,
    ListAgentRunsQuery,
    SearchAgentRunsQuery,
    SearchAgentRunsResponse,
    ListWorkflowRunsResponse,
    WorkflowRunWithDetails,
    parseMessage,
    toAgentMessage,
} from '@vertesia/common';
import { VertesiaClient } from '../client.js';
import { EventSourceProvider } from '../execute.js';

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
    start<TData = Record<string, any>>(
        payload: CreateAgentRunPayload<TData>,
    ): Promise<AgentRun<TData>> {
        return this.post('/', { payload });
    }

    /**
     * Record an AgentRun for an already-running workflow (e.g. schedule-triggered).
     * Only creates the MongoDB document — the workflow passes its own Temporal IDs.
     */
    createRecord(payload: {
        interaction: string;
        schedule_id?: string;
        workflow_id: string;
        first_workflow_run_id: string;
        visibility?: string;
        data?: Record<string, any>;
        type?: string;
    }): Promise<AgentRun> {
        return this.post('/record', { payload });
    }

    /**
     * Get agent run by id.
     */
    retrieve<TData = Record<string, any>>(id: string): Promise<AgentRun<TData>> {
        return this.get(`/${id}`);
    }

    /**
     * List agent runs with optional filters.
     */
    list(query?: ListAgentRunsQuery): Promise<AgentRun[]> {
        const params: Record<string, string> = {};
        if (query?.status) {
            params.status = Array.isArray(query.status) ? query.status.join(',') : query.status;
        }
        if (query?.interaction) params.interaction = query.interaction;
        if (query?.started_by) params.started_by = query.started_by;
        if (query?.since) params.since = query.since.toISOString();
        if (query?.schedule_id) params.schedule_id = query.schedule_id;
        if (query?.type) params.type = query.type;
        if (query?.limit) params.limit = String(query.limit);
        if (query?.offset) params.offset = String(query.offset);
        if (query?.sort) params.sort = query.sort;
        if (query?.order) params.order = query.order;
        return this.get('/', { query: params });
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
        if (query?.limit) params.limit = String(query.limit);
        if (query?.offset) params.offset = String(query.offset);
        return this.get('/search', { query: params });
    }

    /**
     * Cancel/terminate an agent run.
     */
    terminate(id: string, reason?: string): Promise<{ message: string }> {
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

    /**
     * Update agent run status/metadata.
     * Called by workflow activities to sync lifecycle state.
     */
    updateStatus(
        id: string,
        update: {
            status?: AgentRunStatus;
            title?: string;
            topic?: string;
            name?: string;
        },
    ): Promise<AgentRun> {
        return this.post(`/${id}/status`, { payload: update });
    }

    // ========================================================================
    // Communication
    // ========================================================================

    /**
     * Send a signal to a running agent.
     * Signals: "UserInput", "Stop", "FileUploaded"
     */
    sendSignal(id: string, signalName: string, payload?: any): Promise<{ message: string }> {
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
        const response = (await this.get(`/${id}/updates`, { query })) as {
            messages: CompactMessage[];
        };
        return response.messages.map((m: CompactMessage) => toAgentMessage(m, id));
    }

    /**
     * Post a message/update to an agent run.
     */
    postMessage(id: string, msg: Partial<AgentMessage>): Promise<void> {
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
        return new Promise<unknown>(async (resolve, reject) => {
            let reconnectAttempts = 0;
            let lastMessageTimestamp = since || 0;
            let isClosed = false;
            let currentSse: EventSource | null = null;
            let interval: NodeJS.Timeout | null = null;
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
                    resolve(payload);
                }
            };

            if (signal) {
                if (signal.aborted) { isClosed = true; cleanup(); resolve(null); return; }
                abortHandler = () => { exit(null); };
                signal.addEventListener('abort', abortHandler, { once: true });
            }

            // 1. Fetch historical messages via GET /updates (gzip-compressed)
            try {
                if (isClosed) return;
                const historical = await this.retrieveMessages(id, since);
                if (isClosed) return;
                for (const msg of historical) {
                    if (isClosed) return;
                    lastMessageTimestamp = Math.max(lastMessageTimestamp, msg.timestamp || 0);
                    if (onMessage) onMessage(msg, exit);
                    if (isClosed) return;

                    const workstreamId = msg.workstream_id || 'main';
                    const streamIsOver =
                        msg.type === AgentMessageType.TERMINATED ||
                        (msg.type === AgentMessageType.COMPLETE && workstreamId === 'main');
                    if (streamIsOver) {
                        exit(null);
                        return;
                    }
                }
            } catch (err) {
                if (isClosed) return;
                console.warn('Failed to fetch historical messages, continuing with SSE:', err);
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
                        reject(new Error('No auth token available'));
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

                    sse.onopen = () => {
                        if (isReconnect) console.log(`Reconnected to agent stream ${id}`);
                        reconnectAttempts = 0;
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

                            const workstreamId = compactMessage.w || 'main';
                            const streamIsOver =
                                compactMessage.t === AgentMessageType.TERMINATED ||
                                (compactMessage.t === AgentMessageType.COMPLETE && workstreamId === 'main');
                            if (streamIsOver) {
                                exit(null);
                            }
                        } catch (err) {
                            console.error('Failed to parse SSE message:', err, ev.data);
                        }
                    };

                    sse.onerror = (_err: any) => {
                        if (isClosed) return;
                        cleanup();

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
                            reject(new Error(`SSE connection failed after ${maxReconnectAttempts} reconnection attempts`));
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
                        reject(err);
                    }
                }
            };

            setupStream(false);
        });
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
            historyFormat?: 'events' | 'tasks' | 'agent';
        },
    ): Promise<WorkflowRunWithDetails> {
        const query: Record<string, string> = {};
        if (options?.includeHistory) query.include_history = 'true';
        if (options?.historyFormat) query.history_format = options.historyFormat;
        return this.get(`/${id}/details`, { query });
    }

    /**
     * Stream Temporal history events via SSE (handles continueAsNew).
     * Returns an EventSource that emits 'history' and 'control' events.
     */
    async streamRunDetails(
        id: string,
        onEvent?: (event: { type: string; data: unknown }) => void,
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
                    const data = JSON.parse(ev.data);
                    if (onEvent) onEvent({ type: 'history', data });
                } catch (_err) { /* ignore parse errors */ }
            });

            sse.addEventListener('control', (ev: MessageEvent) => {
                try {
                    const data = JSON.parse(ev.data);
                    if (onEvent) onEvent({ type: 'control', data });
                    if (data.type === 'done') {
                        cleanup();
                        resolve();
                    }
                } catch (_err) { /* ignore parse errors */ }
            });

            sse.addEventListener('error', (ev: MessageEvent) => {
                try {
                    const data = JSON.parse(ev.data);
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
     * List child workflows (sub-agents) for an agent run.
     */
    listChildren(id: string): Promise<ListWorkflowRunsResponse> {
        return this.get(`/${id}/children`);
    }

    // ========================================================================
    // Artifacts
    // ========================================================================

    /**
     * List artifacts for an agent run.
     */
    listArtifacts(id: string): Promise<string[]> {
        return this.get(`/${id}/artifacts`);
    }

    /**
     * Get a signed download URL for an artifact.
     */
    getArtifactUrl(
        id: string,
        path: string,
        disposition?: 'inline' | 'attachment',
    ): Promise<{ url: string; path: string }> {
        const query: Record<string, string> = { url: '1' };
        if (disposition) query.disposition = disposition;
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
    ): Promise<{ url: string; path: string }> {
        const mimeType = contentType || 'application/octet-stream';

        // 1. Get signed upload URL from the agents API
        const result = await this.put(`/${id}/artifacts/${path}`, {
            headers: { 'Content-Type': mimeType },
        }) as { url: string; path: string };

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
}
