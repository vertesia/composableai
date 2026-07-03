import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from '../client.js';

class FakeEventSource {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    static urls: string[] = [];

    readonly url: string;
    readonly withCredentials = false;
    readyState = FakeEventSource.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string) {
        this.url = url;
        FakeEventSource.urls.push(url);
    }

    close() {
        this.readyState = FakeEventSource.CLOSED;
    }

    addEventListener() {}

    removeEventListener() {}

    dispatchEvent() {
        return true;
    }
}

function createClient(): VertesiaClient {
    const client = new VertesiaClient({
        serverUrl: 'https://studio.example.test',
        storeUrl: 'https://store.example.test',
    });
    client.withAuthCallback(async () => 'Bearer test-token');
    return client;
}

function message(timestamp: number): AgentMessage {
    return {
        type: AgentMessageType.THOUGHT,
        timestamp,
        workflow_run_id: 'run-1',
        message: 'historical',
        workstream_id: 'main',
    };
}

function mockApiGet<T extends object>(api: T, response: unknown) {
    return vi
        .spyOn(api as unknown as { get: (path: string, options?: unknown) => Promise<unknown> }, 'get')
        .mockResolvedValue(response);
}

describe('streamMessages GET-to-SSE handoff', () => {
    beforeEach(() => {
        FakeEventSource.urls = [];
        vi.stubGlobal('EventSource', FakeEventSource);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('uses a positive SSE since cursor for an agent run with empty initial history', async () => {
        const client = createClient();
        vi.spyOn(client.agents, 'retrieveMessages').mockResolvedValue([]);
        const abort = new AbortController();

        const stream = client.agents.streamMessages('agent-run-1', undefined, undefined, abort.signal);

        await vi.waitFor(() => expect(FakeEventSource.urls).toHaveLength(1));

        const streamUrl = new URL(FakeEventSource.urls[0]);
        expect(streamUrl.searchParams.get('skipHistory')).toBe('true');
        expect(Number(streamUrl.searchParams.get('since'))).toBeGreaterThan(0);

        abort.abort();
        await stream;
    });

    it('keeps the latest historical timestamp as the SSE since cursor for an agent run', async () => {
        const client = createClient();
        vi.spyOn(client.agents, 'retrieveMessages').mockResolvedValue([message(1_234)]);
        const abort = new AbortController();

        const stream = client.agents.streamMessages('agent-run-1', undefined, undefined, abort.signal);

        await vi.waitFor(() => expect(FakeEventSource.urls).toHaveLength(1));

        const streamUrl = new URL(FakeEventSource.urls[0]);
        expect(streamUrl.searchParams.get('since')).toBe('1234');

        abort.abort();
        await stream;
    });

    it('delivers full agent history before closing on a terminal historical message', async () => {
        const client = createClient();
        const complete = {
            ...message(1_000),
            type: AgentMessageType.COMPLETE,
            message: 'previous turn complete',
        };
        const latest = {
            ...message(2_000),
            message: 'newer historical message',
        };
        vi.spyOn(client.agents, 'retrieveMessages').mockResolvedValue([complete, latest]);
        const delivered: AgentMessage[] = [];
        const abort = new AbortController();

        const stream = client.agents.streamMessages(
            'agent-run-1',
            (msg) => {
                delivered.push(msg);
            },
            undefined,
            abort.signal,
        );

        await vi.waitFor(() => expect(FakeEventSource.urls).toHaveLength(1));

        expect(delivered.map((msg) => msg.message)).toEqual(['previous turn complete', 'newer historical message']);
        expect(new URL(FakeEventSource.urls[0]).searchParams.get('since')).toBe('2000');

        abort.abort();
        await stream;
    });

    it('normalizes legacy agent history messages before returning them to the UI', async () => {
        const client = createClient();
        mockApiGet(client.agents, {
            messages: [
                {
                    type: 8,
                    timestamp: 1_000,
                    workflow_run_id: 'legacy-run',
                    message: 'What are the news headlines in France today?',
                    workstream_id: 'main',
                    details: { event_class: 'user_content' },
                },
                {
                    type: 7,
                    timestamp: 2_000,
                    workflow_run_id: 'legacy-run',
                    message: 'Here are the headlines.',
                    workstream_id: 'main',
                    details: { streamed: true },
                },
            ],
        });

        const messages = await client.agents.retrieveMessages('agent-run-1');

        expect(messages).toEqual([
            expect.objectContaining({
                type: AgentMessageType.QUESTION,
                timestamp: 1_000,
                workflow_run_id: 'agent-run-1',
                message: 'What are the news headlines in France today?',
                details: { event_class: 'user_content' },
            }),
            expect.objectContaining({
                type: AgentMessageType.ANSWER,
                timestamp: 2_000,
                workflow_run_id: 'agent-run-1',
                message: 'Here are the headlines.',
                details: { streamed: true },
            }),
        ]);
    });

    it('normalizes legacy workflow history messages before returning them to the UI', async () => {
        const client = createClient();
        mockApiGet(client.workflows, {
            messages: [
                {
                    type: 'answer',
                    timestamp: 3_000,
                    workflow_run_id: 'legacy-run',
                    message: 'Workflow answer',
                    workstream_id: 'main',
                },
            ],
        });

        const messages = await client.workflows.retrieveMessages('workflow-1', 'workflow-run-1');

        expect(messages).toEqual([
            expect.objectContaining({
                type: AgentMessageType.ANSWER,
                timestamp: 3_000,
                workflow_run_id: 'workflow-run-1',
                message: 'Workflow answer',
            }),
        ]);
    });

    it('uses a positive SSE since cursor for a workflow run with empty initial history', async () => {
        const client = createClient();
        vi.spyOn(client.workflows, 'retrieveMessages').mockResolvedValue([]);
        const abort = new AbortController();

        const stream = client.workflows.streamMessages(
            'workflow-1',
            'workflow-run-1',
            undefined,
            undefined,
            abort.signal,
        );

        await vi.waitFor(() => expect(FakeEventSource.urls).toHaveLength(1));

        const streamUrl = new URL(FakeEventSource.urls[0]);
        expect(streamUrl.searchParams.get('skipHistory')).toBe('true');
        expect(Number(streamUrl.searchParams.get('since'))).toBeGreaterThan(0);

        abort.abort();
        await stream;
    });
});
