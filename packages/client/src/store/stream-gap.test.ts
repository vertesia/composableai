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
