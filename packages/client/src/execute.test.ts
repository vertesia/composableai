import { ExecutionRunStatus } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';
import { executeInteractionByName } from './execute.js';

class TestEventSource extends EventTarget {
    static instances: TestEventSource[] = [];
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    readyState = 1;
    close = vi.fn();
    constructor(public url: string) {
        super();
        TestEventSource.instances.push(this);
    }
    emit(type: string, data: unknown) {
        this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
}

afterEach(() => {
    TestEventSource.instances = [];
    vi.unstubAllGlobals();
});

describe('interaction streaming completion', () => {
    it('rejects a terminal stream error instead of hanging', async () => {
        vi.stubGlobal('EventSource', TestEventSource);
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
            apikey: 'test-token',
            fetch: vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ id: 'run', status: ExecutionRunStatus.created }))),
        });
        const promise = client.interactions.execute('image-interaction', {}, vi.fn());
        const rejected = expect(promise).rejects.toThrow('stream closed before completion');
        await vi.waitFor(() => expect(TestEventSource.instances).toHaveLength(1));
        const sse = TestEventSource.instances[0];
        sse.readyState = TestEventSource.CLOSED;
        sse.dispatchEvent(new Event('error'));
        await rejected;
        expect(sse.close).toHaveBeenCalledOnce();
    });
    it.each(['execute', 'executeByName'] as const)(
        'completes after a transient stream error through %s',
        async (method) => {
            vi.stubGlobal('EventSource', TestEventSource);
            const client = new VertesiaClient({
                serverUrl: 'https://api.example.com',
                storeUrl: 'https://api.example.com',
                apikey: 'test-token',
                fetch: vi
                    .fn()
                    .mockResolvedValue(new Response(JSON.stringify({ id: 'run', status: ExecutionRunStatus.created }))),
            });
            const onChunk = vi.fn();
            const promise = client.interactions[method]('image-interaction', {}, onChunk);
            await vi.waitFor(() => expect(TestEventSource.instances).toHaveLength(1));
            const sse = TestEventSource.instances[0];
            sse.readyState = TestEventSource.CONNECTING;
            sse.dispatchEvent(new Event('error'));
            expect(sse.close).not.toHaveBeenCalled();

            sse.readyState = TestEventSource.OPEN;
            sse.emit('message', 'resumed chunk');
            sse.emit('close', {
                id: 'run',
                status: ExecutionRunStatus.completed,
                result: [{ type: 'image', value: 's3://bucket/image.jpg' }],
            });

            const result = await promise;
            expect(result.status).toBe(ExecutionRunStatus.completed);
            expect(result.result.images()).toEqual(['s3://bucket/image.jpg']);
            expect(onChunk).toHaveBeenCalledExactlyOnceWith('resumed chunk');
            expect(sse.close).toHaveBeenCalledOnce();
        },
    );
    it.each(['execute', 'executeByName'] as const)('returns enhanced image results through %s', async (method) => {
        vi.stubGlobal('EventSource', TestEventSource);
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
            apikey: 'test-token',
            fetch: vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ id: 'run', status: ExecutionRunStatus.created }))),
        });
        const onChunk = vi.fn();
        const promise = client.interactions[method]('image-interaction', {}, onChunk);
        await vi.waitFor(() => expect(TestEventSource.instances).toHaveLength(1));
        const sse = TestEventSource.instances[0];
        sse.emit('message', 'chunk');
        sse.emit('close', {
            id: 'run',
            status: ExecutionRunStatus.completed,
            result: [{ type: 'image', value: 's3://bucket/image.jpg' }],
        });

        const result = await promise;
        expect(result.status).toBe(ExecutionRunStatus.completed);
        expect(result.result.images()).toEqual(['s3://bucket/image.jpg']);
        expect(onChunk).toHaveBeenCalledWith('chunk');
        expect(sse.close).toHaveBeenCalledOnce();
    });

    it.each(['execute', 'executeByName'] as const)('preserves final failure through %s', async (method) => {
        vi.stubGlobal('EventSource', TestEventSource);
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
            apikey: 'test-token',
            fetch: vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ id: 'run', status: ExecutionRunStatus.created }))),
        });
        const promise = client.interactions[method]('image-interaction', {}, vi.fn());
        await vi.waitFor(() => expect(TestEventSource.instances).toHaveLength(1));
        TestEventSource.instances[0].emit('close', {
            id: 'run',
            status: ExecutionRunStatus.failed,
            error: { code: 'generation_error', message: 'generation failed' },
        });
        await expect(promise).resolves.toMatchObject({
            status: ExecutionRunStatus.failed,
            error: { message: 'generation failed' },
        });
    });
});

describe('executeInteractionByName', () => {
    it('forwards private per-request headers without placing them in the execution payload', async () => {
        const post = vi.fn().mockResolvedValue({ id: 'run-1', status: 'completed' });
        const client = { post } as unknown as VertesiaClient;

        await executeInteractionByName(client, 'sys:test', { data: { message: 'hello' } }, undefined, {
            headers: { 'x-vertesia-required-tool-name': 'app_workspace_init' },
        });

        expect(post).toHaveBeenCalledWith(
            '/api/v1/execute',
            expect.objectContaining({
                headers: { 'x-vertesia-required-tool-name': 'app_workspace_init' },
                payload: expect.not.objectContaining({ required_tool_name: expect.anything() }),
            }),
        );
    });
});

describe('executeInteractionByName request options', () => {
    function mockClient() {
        const post = vi.fn().mockResolvedValue({ id: 'run-1', status: 'completed' });
        return { post, client: { post } as unknown as VertesiaClient };
    }

    it('forwards the typed execute query', async () => {
        const { post, client } = mockClient();

        await executeInteractionByName(client, 'sys:test', {}, undefined, { query: { include_prompt: false } });

        expect(post).toHaveBeenCalledWith(
            '/api/v1/execute',
            expect.objectContaining({ query: { include_prompt: false } }),
        );
    });

    it('keeps the long execution timeout when none is given', async () => {
        const { post, client } = mockClient();

        await executeInteractionByName(client, 'sys:test', {});

        expect(post.mock.calls[0][1].timeoutMs).toEqual(expect.any(Number));
        expect(post.mock.calls[0][1].timeoutMs).toBeGreaterThan(0);
    });

    it.each([null, false, 0, 5_000] as const)('honours an explicit timeoutMs of %s', async (timeoutMs) => {
        const { post, client } = mockClient();

        await executeInteractionByName(client, 'sys:test', {}, undefined, { timeoutMs });

        expect(post.mock.calls[0][1].timeoutMs).toBe(timeoutMs);
    });

    it('rejects options the method cannot honour at compile time', () => {
        const { client } = mockClient();
        const calls = [
            // @ts-expect-error the method parses the JSON execution result itself
            () => executeInteractionByName(client, 'sys:test', {}, undefined, { reader: 'sse' }),
            // @ts-expect-error the method serializes the payload it builds
            () => executeInteractionByName(client, 'sys:test', {}, undefined, { jsonPayload: false }),
            // @ts-expect-error the query is the published execute query, so a misspelt parameter fails
            () => executeInteractionByName(client, 'sys:test', {}, undefined, { query: { include_promt: false } }),
        ];
        expect(calls).toHaveLength(3);
    });
});

describe('executeInteractionAsync retries', () => {
    /** A client whose own policy retries POST; the server fails the first attempt with a retryable 503. */
    function createRetryingClient(bodies: string[]) {
        let attempt = 0;
        return new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
            apikey: 'test-token',
            retryPolicy: { attempts: 3, methods: ['POST'], baseDelayMs: 0, jitter: false },
            fetch: vi.fn(async (input: RequestInfo) => {
                bodies.push(input instanceof Request ? await input.text() : '');
                attempt++;
                return attempt === 1
                    ? new Response('unavailable', { status: 503 })
                    : Response.json({ workflowId: 'wf', runId: 'run', agentRunId: 'agent-run' });
            }),
        });
    }

    it('never replays an unkeyed conversation, which starts an agent run', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await expect(
            client.interactions.executeAsync({ type: 'conversation', interaction: 'sys:GeneralAgent' }),
        ).rejects.toMatchObject({ status: 503 });
        expect(bodies).toHaveLength(1);
    });

    it('retries a keyed conversation with the same body and key', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await client.interactions.executeAsync({
            type: 'conversation',
            interaction: 'sys:GeneralAgent',
            idempotency_key: 'key-1',
        });
        expect(bodies).toHaveLength(2);
        expect(bodies[1]).toBe(bodies[0]);
    });

    it('keeps the client policy for an interaction execution', async () => {
        const bodies: string[] = [];
        const client = createRetryingClient(bodies);

        await client.interactions.executeAsync({ type: 'interaction', interaction: 'Summarize' });
        expect(bodies).toHaveLength(2);
    });
});
