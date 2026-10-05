import { afterEach, describe, expect, it, vi } from 'vitest';
import { StreamSource } from '../StreamSource.js';
import { ZenoClient } from './client.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe.each(['file', 'object'] as const)('%s PUT response cleanup', (kind) => {
    it.each([
        [200, 'complete'],
        [403, 'complete'],
        [200, 'stall'],
        [403, 'stall'],
        [200, 'reject'],
        [403, 'reject'],
    ] as const)('preserves the upload result for HTTP %s when cleanup can %s', async (status, cleanup) => {
        const cancel = vi.fn(() => {
            if (cleanup === 'stall') return new Promise<void>(() => undefined);
            if (cleanup === 'reject') return Promise.reject(new Error('Cleanup failed'));
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(new ReadableStream({ cancel }), {
                    status,
                    statusText: status === 200 ? 'OK' : 'Forbidden',
                    headers: { etag: '"stored"' },
                }),
            ),
        );
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const client = new ZenoClient({
            serverUrl: 'https://api.example.com',
            fetch: vi.fn(async () =>
                Response.json({
                    id: 'file',
                    path: 'image.png',
                    url: 'https://storage.example.com/image',
                }),
            ),
        });
        const source = new StreamSource(
            new ReadableStream({
                start(controller) {
                    controller.close();
                },
            }),
            'image.png',
            'image/png',
        );
        const pending = kind === 'file' ? client.files.uploadFile(source) : client.objects.upload(source);
        if (status === 200) {
            if (kind === 'file') await expect(pending).resolves.toBe('file');
            else
                await expect(pending).resolves.toEqual({
                    source: 'file',
                    name: 'image.png',
                    type: 'image/png',
                    etag: 'stored',
                });
        } else await expect(pending).rejects.toThrow('Failed to upload file: Forbidden');
        expect(cancel).toHaveBeenCalledTimes(1);
    });
});
