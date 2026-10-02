import { afterEach, describe, expect, it, vi } from 'vitest';
import { StreamSource } from '../StreamSource.js';
import { ZenoClient } from './client.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
