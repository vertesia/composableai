import { type AgentMessage, AgentMessageType, type CompactMessage } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from '../client.js';

const AGENT_RUN_ID = 'run-1';
const STORE_URL = 'https://store.example.test';

class FakeEventSource {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    static instances: FakeEventSource[] = [];
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
        FakeEventSource.instances.push(this);
    }

    close() {
        this.readyState = FakeEventSource.CLOSED;
    }

    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
        return true;
    }

    fail() {
        this.onerror?.(new Event('error'));
    }

    emit(message: CompactMessage) {
        this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
    }
}

interface Harness {
    client: VertesiaClient;
    /** `since` query value of every GET /updates call after the initial history fetch. */
    pollSince: number[];
    setHistory: (messages: CompactMessage[]) => void;
    setPollResponse: (handler: (since: number) => CompactMessage[]) => void;
    setRunStatus: (status: string) => void;
    issuedTokens: string[];
}

function createHarness(): Harness {
    let history: CompactMessage[] = [];
    let pollResponse: (since: number) => CompactMessage[] = () => [];
    let runStatus = 'running';
    let historyServed = false;
    const pollSince: number[] = [];
    const issuedTokens: string[] = [];

    const fetchMock = vi.fn(async (input: Request | string) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        if (url.pathname.endsWith('/updates')) {
            if (!historyServed) {
                historyServed = true;
                return Response.json({ messages: history });
            }
            const since = Number(url.searchParams.get('since') ?? 0);
            pollSince.push(since);
            return Response.json({ messages: pollResponse(since) });
        }
        if (url.pathname.endsWith(`/${AGENT_RUN_ID}`)) {
            return Response.json({ id: AGENT_RUN_ID, status: runStatus });
        }
        return Response.json({ error: 'not found' }, { status: 404 });
    });

    const client = new VertesiaClient({
        serverUrl: 'https://studio.example.test',
        storeUrl: STORE_URL,
        fetch: fetchMock as unknown as typeof fetch,
    });

    // Mimics a refreshing credential provider: every call hands out a newer token.
    client.withAuthCallback(async () => {
        const token = `token-${issuedTokens.length + 1}`;
        issuedTokens.push(token);
        return `Bearer ${token}`;
    });

    return {
        client,
        pollSince,
        issuedTokens,
        setHistory: (messages) => {
            history = messages;
        },
        setPollResponse: (handler) => {
            pollResponse = handler;
        },
        setRunStatus: (status) => {
            runStatus = status;
        },
    };
}

/** Advance fake timers and drain the microtask queue so awaited fetches settle. */
async function settle(ms = 0) {
    await vi.advanceTimersByTimeAsync(ms);
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
}

/** Longer than the capped backoff delay (30s + jitter). */
const BACKOFF_CEILING_MS = 40000;

async function failCurrentConnection() {
    FakeEventSource.instances[FakeEventSource.instances.length - 1].fail();
    await settle(BACKOFF_CEILING_MS);
}

describe('AgentsApi.streamMessages reconnection', () => {
    let logs: string[];
    let warnings: string[];

    beforeEach(() => {
        vi.useFakeTimers();
        FakeEventSource.instances = [];
        FakeEventSource.urls = [];
        logs = [];
        warnings = [];
        vi.stubGlobal('EventSource', FakeEventSource);
        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logs.push(args.map(String).join(' '));
        });
        vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
            warnings.push(args.map(String).join(' '));
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('keeps interactive streams open on root IDLE by default', async () => {
        const harness = createHarness();
        const settled = vi.fn();
        const received: AgentMessage[] = [];
        const done = harness.client.agents
            .streamMessages(AGENT_RUN_ID, (message) => received.push(message))
            .then(settled);
        await settle();

        FakeEventSource.instances[0].emit({
            t: AgentMessageType.IDLE,
            m: 'Waiting for your command...',
            w: 'main',
            ts: 1_000,
        });
        await settle();
        expect(settled).not.toHaveBeenCalled();

        FakeEventSource.instances[0].emit({
            t: AgentMessageType.ANSWER,
            m: 'Follow-up response',
            w: 'main',
            ts: 1_500,
        });
        await settle();
        expect(received.map((message) => message.message)).toEqual([
            'Waiting for your command...',
            'Follow-up response',
        ]);

        FakeEventSource.instances[0].emit({
            t: AgentMessageType.COMPLETE,
            m: 'Conversation complete',
            w: 'main',
            ts: 2_000,
        });
        await expect(done).resolves.toBeUndefined();
    });

    it('lets headless followers opt into closing on root IDLE', async () => {
        const harness = createHarness();
        const done = harness.client.agents.streamMessages(AGENT_RUN_ID, undefined, undefined, undefined, {
            closeOnIdle: true,
        });
        await settle();

        FakeEventSource.instances[0].emit({
            t: AgentMessageType.IDLE,
            m: 'Waiting for your command...',
            w: 'main',
            ts: 1_000,
        });

        await expect(done).resolves.toBeNull();
    });

    it('resolves a fresh auth token for every reconnection attempt', async () => {
        const harness = createHarness();
        const abort = new AbortController();
        void harness.client.agents.streamMessages(AGENT_RUN_ID, undefined, undefined, abort.signal);
        await settle();

        expect(FakeEventSource.instances).toHaveLength(1);
        await failCurrentConnection();
        await failCurrentConnection();
        expect(FakeEventSource.instances).toHaveLength(3);

        const tokens = FakeEventSource.urls.map((url) => new URL(url).searchParams.get('access_token'));
        expect(tokens).toHaveLength(3);
        expect(new Set(tokens).size).toBe(3);
        expect(tokens.every((token) => token?.startsWith('token-'))).toBe(true);

        abort.abort();
        await settle();
    });

    it('never announces an attempt number above the stated maximum', async () => {
        const harness = createHarness();
        const abort = new AbortController();
        void harness.client.agents.streamMessages(AGENT_RUN_ID, undefined, undefined, abort.signal);
        await settle();

        // 10 reconnects are allowed; the 11th failure must degrade instead of announcing 11/10.
        for (let i = 0; i < 11; i++) {
            await failCurrentConnection();
        }

        const announced = logs
            .map((line) => /\(attempt (\d+)\/(\d+)\)/.exec(line))
            .filter((match): match is RegExpExecArray => match !== null)
            .map((match) => ({ attempt: Number(match[1]), max: Number(match[2]) }));

        expect(announced).toHaveLength(10);
        expect(announced.map((entry) => entry.attempt)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(announced.every((entry) => entry.attempt <= entry.max)).toBe(true);
        expect(FakeEventSource.instances).toHaveLength(11);
        expect(warnings.some((line) => line.includes('SSE unavailable after 10 attempts'))).toBe(true);

        abort.abort();
        await settle();
    });

    it('polls GET /updates from the last received timestamp and emits the messages', async () => {
        const harness = createHarness();
        harness.setHistory([{ t: AgentMessageType.UPDATE, m: 'history', ts: 1000 }]);
        harness.setPollResponse((since) =>
            since < 2000 ? [{ t: AgentMessageType.UPDATE, m: 'polled', ts: 2000 }] : [],
        );

        const received: AgentMessage[] = [];
        const abort = new AbortController();
        void harness.client.agents.streamMessages(
            AGENT_RUN_ID,
            (message) => received.push(message),
            undefined,
            abort.signal,
        );
        await settle();

        for (let i = 0; i < 11; i++) {
            await failCurrentConnection();
        }
        await settle(6000);

        // The first poll resumes at the history cursor, later polls at the last polled message.
        expect(harness.pollSince[0]).toBe(1000);
        expect(harness.pollSince[1]).toBe(2000);
        expect(received.map((message) => message.message)).toEqual(['history', 'polled']);
        // Polled messages reach the caller as fully-formed AgentMessages, like the SSE path.
        expect(received[1]).toMatchObject({
            type: AgentMessageType.UPDATE,
            workflow_run_id: AGENT_RUN_ID,
            workstream_id: 'main',
            timestamp: 2000,
        });

        abort.abort();
        await settle();
    });

    it('warns on every polling failure instead of failing silently', async () => {
        const harness = createHarness();
        harness.setHistory([{ t: AgentMessageType.UPDATE, m: 'history', ts: 1000 }]);
        harness.setPollResponse(() => {
            throw new Error('boom');
        });

        const abort = new AbortController();
        void harness.client.agents.streamMessages(AGENT_RUN_ID, undefined, undefined, abort.signal);
        await settle();

        for (let i = 0; i < 11; i++) {
            await failCurrentConnection();
        }
        await settle(6000);

        const pollWarnings = warnings.filter((line) => line.includes('GET /updates failed while polling'));
        expect(pollWarnings.length).toBeGreaterThanOrEqual(2);
        expect(pollWarnings[0]).toContain('consecutive failures: 1');
        expect(pollWarnings[1]).toContain('consecutive failures: 2');

        abort.abort();
        await settle();
    });

    it('retries SSE after the polling fallback so an outage is not permanent', async () => {
        const harness = createHarness();
        const abort = new AbortController();
        void harness.client.agents.streamMessages(AGENT_RUN_ID, undefined, undefined, abort.signal);
        await settle();

        for (let i = 0; i < 11; i++) {
            await failCurrentConnection();
        }
        const connectionsBeforeRetry = FakeEventSource.instances.length;
        expect(warnings.some((line) => line.includes('SSE retried every 60s'))).toBe(true);

        await settle(61000);

        expect(FakeEventSource.instances.length).toBe(connectionsBeforeRetry + 1);
        expect(logs.some((line) => line.includes('retrying the SSE connection'))).toBe(true);

        abort.abort();
        await settle();
    });

    it('closes the stream when polling observes a terminal run status', async () => {
        const harness = createHarness();
        const abort = new AbortController();
        const done = harness.client.agents.streamMessages(AGENT_RUN_ID, undefined, undefined, abort.signal);
        await settle();

        for (let i = 0; i < 11; i++) {
            await failCurrentConnection();
        }
        harness.setRunStatus('completed');
        await settle(6000);

        await expect(done).resolves.toBeNull();
    });
});
