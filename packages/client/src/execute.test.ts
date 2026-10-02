import { ExecutionRunStatus } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

class TestEventSource extends EventTarget {
    static instances: TestEventSource[] = [];
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
