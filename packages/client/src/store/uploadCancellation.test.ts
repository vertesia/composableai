import { afterEach, describe, expect, it, vi } from 'vitest';
import { StreamSource } from '../StreamSource.js';
import { ZenoClient } from './client.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('upload API cancellation', () => {
    it.each(['file', 'object'] as const)(
        'propagates cancellation from %s creation to the storage PUT',
        async (kind) => {
            const controller = new AbortController();
            let transferSignal: AbortSignal | null | undefined;
            const transfer = vi.fn((_url: string, init: RequestInit) => {
                transferSignal = init.signal;
                return new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
                });
            });
            vi.stubGlobal('fetch', transfer);
            const requests: Request[] = [];
            const client = new ZenoClient({
                serverUrl: 'https://api.example.com',
                fetch: vi.fn(async () =>
                    Response.json({ id: 'file', path: 'images/file.png', url: 'https://storage.example.com/file' }),
                ),
                onRequest: (request) => requests.push(request),
            });
            const source = new StreamSource(
                new ReadableStream({
                    start(c) {
                        c.enqueue(new Uint8Array([1]));
                        c.close();
                    },
                }),
                'image.png',
                'image/png',
            );
            vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const pending =
                kind === 'file'
                    ? client.files.uploadFile(source, { signal: controller.signal })
                    : client.objects.create({ content: source }, { signal: controller.signal });
            const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
            await vi.waitFor(() => expect(transferSignal).toBeDefined());
            controller.abort();
            await assertion;
            expect(transferSignal?.aborted).toBe(true);
            expect(requests[0].signal.aborted).toBe(true);
            expect(requests).toHaveLength(1);
            expect(transfer).toHaveBeenCalledTimes(1);
        },
    );
});

it.each([
    ['file', 200],
    ['file', 403],
    ['object', 200],
    ['object', 403],
] as const)('releases the unused %s PUT response body for HTTP %s', async (kind, status) => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { status })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const client = new ZenoClient({
        serverUrl: 'https://api.example.com',
        fetch: vi.fn(async () =>
            Response.json({ id: 'file', path: 'images/file.png', url: 'https://storage.example.com/file' }),
        ),
    });
    const source = new StreamSource(
        new ReadableStream({
            start(c) {
                c.close();
            },
        }),
        'image.png',
        'image/png',
    );
    const pending = kind === 'file' ? client.files.uploadFile(source) : client.objects.upload(source);
    if (status === 200) await pending;
    else await expect(pending).rejects.toThrow('Failed to upload file');
    expect(cancel).toHaveBeenCalledTimes(1);
});

it('cancels an active bulk transfer before starting the next file', async () => {
    const controller = new AbortController();
    let transferSignal: AbortSignal | null | undefined;
    const transfer = vi.fn((_url: string, init: RequestInit) => {
        transferSignal = init.signal;
        return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        });
    });
    vi.stubGlobal('fetch', transfer);
    const requests: Request[] = [];
    const client = new ZenoClient({
        serverUrl: 'https://api.example.com',
        fetch: vi.fn(async () =>
            Response.json({
                files: [
                    { id: 'first', path: 'first.png', url: 'https://storage.example.com/first' },
                    { id: 'second', path: 'second.png', url: 'https://storage.example.com/second' },
                ],
            }),
        ),
        onRequest: (request) => requests.push(request),
    });
    const files = ['first', 'second'].map((name) => new File(['image'], `${name}.png`, { type: 'image/png' }));
    const pending = client.files.bulkUpload(files, 1, { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(transferSignal).toBeDefined());
    controller.abort();
    await assertion;
    expect(transferSignal?.aborted).toBe(true);
    expect(requests[0].signal.aborted).toBe(true);
    expect(transfer).toHaveBeenCalledTimes(1);
});

it.each(['file', 'object'] as const)(
    'does not block a completed %s upload on stalled response cleanup',
    async (kind) => {
        const cancel = vi.fn(() => new Promise<void>(() => undefined));
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { status: 200 })),
        );
        const client = new ZenoClient({
            serverUrl: 'https://api.example.com',
            fetch: vi.fn(async () =>
                Response.json({ id: 'file', path: 'image.png', url: 'https://storage.example.com/image' }),
            ),
        });
        const source = new StreamSource(
            new ReadableStream({
                start(c) {
                    c.close();
                },
            }),
            'image.png',
            'image/png',
        );
        const result = await (kind === 'file' ? client.files.uploadFile(source) : client.objects.upload(source));
        if (kind === 'file') expect(result).toBe('file');
        else expect(result).toMatchObject({ source: 'file', type: 'image/png' });
        expect(cancel).toHaveBeenCalledTimes(1);
    },
);

function mockDeadlines() {
    return vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException('Deadline exceeded', 'TimeoutError')), milliseconds);
        return controller.signal;
    });
}

it('keeps the whole default bulk queue active beyond fifteen minutes and preserves ordered results', async () => {
    vi.useFakeTimers();
    const timeout = mockDeadlines();
    const transfer = vi.fn(
        (_url: string, init: RequestInit) =>
            new Promise<Response>((resolve, reject) => {
                const timer = setTimeout(
                    () => resolve(new Response(null, { status: 200, headers: { etag: '"stored"' } })),
                    8 * 60_000,
                );
                init.signal?.addEventListener(
                    'abort',
                    () => {
                        clearTimeout(timer);
                        reject(init.signal?.reason);
                    },
                    { once: true },
                );
            }),
    );
    vi.stubGlobal('fetch', transfer);
    const client = new ZenoClient({
        serverUrl: 'https://api.example.com',
        fetch: vi.fn(async () =>
            Response.json({
                files: ['first', 'second'].map((id) => ({
                    id,
                    path: `${id}.png`,
                    url: `https://storage.example.com/${id}`,
                })),
            }),
        ),
    });
    const files = ['first', 'second'].map((name) => new File(['image'], `${name}.png`, { type: 'image/png' }));
    const pending = client.files.bulkUpload(files, 1);
    const assertion = expect(pending).resolves.toEqual(
        files.map((file, index) => ({
            source: index === 0 ? 'first' : 'second',
            name: file.name,
            type: 'image/png',
            etag: 'stored',
        })),
    );
    await vi.advanceTimersByTimeAsync(16 * 60_000);
    await assertion;
    expect(transfer).toHaveBeenCalledTimes(2);
    expect(timeout).not.toHaveBeenCalled();
});

it('shares an explicit bulk deadline across signing and successive batches', async () => {
    vi.useFakeTimers();
    mockDeadlines();
    const transfer = vi.fn(
        (_url: string, init: RequestInit) =>
            new Promise<Response>((resolve, reject) => {
                const timer = setTimeout(() => resolve(new Response(null, { status: 204 })), 40);
                init.signal?.addEventListener(
                    'abort',
                    () => {
                        clearTimeout(timer);
                        reject(init.signal?.reason);
                    },
                    { once: true },
                );
            }),
    );
    vi.stubGlobal('fetch', transfer);
    const client = new ZenoClient({
        serverUrl: 'https://api.example.com',
        fetch: vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return Response.json({
                files: ['first', 'second', 'third'].map((id) => ({
                    id,
                    path: `${id}.png`,
                    url: `https://storage.example.com/${id}`,
                })),
            });
        }),
    });
    const files = ['first', 'second', 'third'].map((name) => new File(['image'], `${name}.png`));
    const pending = client.files.bulkUpload(files, 1, { timeoutMs: 90 });
    const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(89);
    expect(transfer).toHaveBeenCalledTimes(2);
    expect(transfer.mock.calls[1][1].signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(transfer.mock.calls[1][1].signal?.aborted).toBe(true);
    expect(transfer).toHaveBeenCalledTimes(2);
});

it('waits for object registration after PUT and preserves the returned object', async () => {
    const controller = new AbortController();
    let register: ((response: Response) => void) | undefined;
    const requests: Request[] = [];
    const apiFetch = vi.fn(async (input: RequestInfo) => {
        if (!(input instanceof Request)) throw new Error('Expected an API Request');
        const request = input;
        requests.push(request);
        if (request.url.endsWith('/upload-url')) {
            return Response.json({ id: 'file', url: 'https://storage.example.com/file' });
        }
        expect(request.signal.aborted).toBe(false);
        return new Promise<Response>((resolve) => {
            register = resolve;
        });
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const client = new ZenoClient({ serverUrl: 'https://api.example.com', fetch: apiFetch });
    let settled = false;
    const pending = client.objects
        .create({ content: new File(['image'], 'image.png') }, { signal: controller.signal })
        .then((result) => {
            settled = true;
            return result;
        });
    await vi.waitFor(() => expect(register).toBeDefined());
    expect(settled).toBe(false);
    register?.(Response.json({ id: 'object' }));
    await expect(pending).resolves.toMatchObject({ id: 'object' });
    controller.abort();
    expect(requests[1].signal.aborted).toBe(true);
});

it('keeps a returned download stream readable beyond fifteen minutes by default', async () => {
    vi.useFakeTimers();
    const timeout = mockDeadlines();
    let producer: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            producer = controller;
        },
    });
    vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, init: RequestInit) => {
            init.signal?.addEventListener('abort', () => producer?.error(init.signal?.reason), { once: true });
            return new Response(stream);
        }),
    );
    const client = new ZenoClient({ serverUrl: 'https://api.example.com' });
    const downloaded = await client.files.downloadFile('https://storage.example.com/large-file');
    const reader = downloaded.getReader();
    await vi.advanceTimersByTimeAsync(16 * 60_000);
    producer?.enqueue(new Uint8Array([1, 2, 3]));
    producer?.close();
    await expect(reader.read()).resolves.toEqual({ done: false, value: new Uint8Array([1, 2, 3]) });
    await expect(reader.read()).resolves.toMatchObject({ done: true });
    reader.releaseLock();
    expect(timeout).not.toHaveBeenCalled();
});

it.each(['signing', 'registration'] as const)('cancels %s and preserves the API error wrapper', async (phase) => {
    const controller = new AbortController();
    let active: Request | undefined;
    const apiFetch = vi.fn(async (input: RequestInfo) => {
        if (!(input instanceof Request)) throw new Error('Expected an API Request');
        if (phase === 'registration' && input.url.endsWith('/upload-url')) {
            return Response.json({ id: 'file', url: 'https://storage.example.com/file' });
        }
        active = input;
        return new Promise<Response>((_resolve, reject) => {
            input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
        });
    });
    const transfer = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', transfer);
    const client = new ZenoClient({ serverUrl: 'https://api.example.com', fetch: apiFetch });
    const pending = client.objects.create({ content: new File(['image'], 'image.png') }, { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ status: 0, payload: { name: 'AbortError' } });
    await vi.waitFor(() => expect(active).toBeDefined());
    controller.abort();
    await assertion;
    expect(active?.signal.aborted).toBe(true);
    expect(transfer).toHaveBeenCalledTimes(phase === 'signing' ? 0 : 1);
    expect(apiFetch).toHaveBeenCalledTimes(phase === 'signing' ? 1 : 2);
});
