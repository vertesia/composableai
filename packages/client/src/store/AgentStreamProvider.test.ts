import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from '../client.js';
import type { AgentRunStreamMessagesOptions, AgentStreamMessageCallback, AgentStreamProvider } from '../index.js';
import { ZenoClient } from './client.js';

const RUN_ID = 'agent-run-1';

const message: AgentMessage = {
    type: AgentMessageType.ANSWER,
    timestamp: 1_234,
    workflow_run_id: RUN_ID,
    message: 'provider message',
    workstream_id: 'main',
};

class FakeEventSource {
    static urls: string[] = [];

    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string) {
        FakeEventSource.urls.push(url);
    }

    close() {}
}

describe('AgentStreamProvider', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('delegates the full stream contract from an actual VertesiaClient without default transport', async () => {
        const fetchMock = vi.fn(async () => {
            throw new Error('default HTTP transport must not run');
        });
        const eventSource = vi.fn(() => {
            throw new Error('default SSE transport must not run');
        });
        vi.stubGlobal('EventSource', eventSource);

        const providerExit = vi.fn();
        const provider: AgentStreamProvider = {
            streamMessages: async (_id, onMessage, _since, _signal, options) => {
                options?.onHistoryLoaded?.([message]);
                onMessage?.(message, providerExit);
                return { source: 'provider' };
            },
        };
        const streamMessages = vi.spyOn(provider, 'streamMessages');
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.test',
            storeUrl: 'https://store.example.test',
            fetch: fetchMock,
            agentStreamProvider: provider,
        });
        const onMessage = vi.fn<AgentStreamMessageCallback>();
        const onHistoryLoaded = vi.fn();
        const onHistoryError = vi.fn();
        const options: AgentRunStreamMessagesOptions = {
            closeOnIdle: true,
            onHistoryLoaded,
            onHistoryError,
        };
        const abort = new AbortController();

        const result = await client.agents.streamMessages(RUN_ID, onMessage, 42, abort.signal, options);

        expect(result).toEqual({ source: 'provider' });
        expect(streamMessages).toHaveBeenCalledWith(RUN_ID, onMessage, 42, abort.signal, options);
        expect(onHistoryLoaded).toHaveBeenCalledWith([message]);
        expect(onHistoryError).not.toHaveBeenCalled();
        expect(onMessage).toHaveBeenCalledWith(message, providerExit);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(eventSource).not.toHaveBeenCalled();
        expect(client.agents).toBe(client.store.agents);
    });

    it('supports direct ZenoClient injection and propagates provider failures without fallback', async () => {
        const failure = new Error('native stream unavailable');
        const fetchMock = vi.fn(async () => {
            throw new Error('default HTTP transport must not run');
        });
        const eventSource = vi.fn(() => {
            throw new Error('default SSE transport must not run');
        });
        vi.stubGlobal('EventSource', eventSource);
        const provider: AgentStreamProvider = {
            streamMessages: vi.fn(async () => {
                throw failure;
            }),
        };
        const client = new ZenoClient({
            serverUrl: 'https://store.example.test',
            fetch: fetchMock,
            agentStreamProvider: provider,
        });

        await expect(client.agents.streamMessages(RUN_ID)).rejects.toBe(failure);
        expect(provider.streamMessages).toHaveBeenCalledOnce();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(eventSource).not.toHaveBeenCalled();
    });

    it('keeps ordinary REST requests on the shared refreshing auth callback when a provider is configured', async () => {
        const requests: Request[] = [];
        const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
            requests.push(new Request(input, init));
            return Response.json({ id: RUN_ID });
        });
        const provider: AgentStreamProvider = {
            streamMessages: vi.fn(async () => null),
        };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.test',
            storeUrl: 'https://store.example.test',
            fetch: fetchMock,
            agentStreamProvider: provider,
        });
        let token = 'first-token';
        client.withAuthCallback(async () => `Bearer ${token}`);

        await client.agents.retrieve(RUN_ID);
        token = 'refreshed-token';
        await client.agents.retrieve(RUN_ID);

        expect(requests.map((request) => request.headers.get('authorization'))).toEqual([
            'Bearer first-token',
            'Bearer refreshed-token',
        ]);
        expect(provider.streamMessages).not.toHaveBeenCalled();
    });

    it('retains the default history, browser SSE, and auth callback path without a provider', async () => {
        FakeEventSource.urls = [];
        vi.stubGlobal('EventSource', FakeEventSource);
        const fetchMock = vi.fn(async () => Response.json({ messages: [] }));
        const auth = vi.fn(async () => 'Bearer refreshed-token');
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.test',
            storeUrl: 'https://store.example.test',
            fetch: fetchMock,
        });
        client.withAuthCallback(auth);
        const abort = new AbortController();

        const stream = client.agents.streamMessages(RUN_ID, undefined, 10, abort.signal);
        await vi.waitFor(() => expect(FakeEventSource.urls).toHaveLength(1));

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(new URL(FakeEventSource.urls[0]).pathname).toBe(`/api/v1/agents/${RUN_ID}/stream`);
        expect(new URL(FakeEventSource.urls[0]).searchParams.get('access_token')).toBe('refreshed-token');
        // The history request and EventSource connection each resolve the current credential.
        expect(auth).toHaveBeenCalledTimes(2);

        abort.abort();
        await expect(stream).resolves.toBeNull();
    });
});
