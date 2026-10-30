import type { VertesiaClient } from '@vertesia/client';
import { describe, expect, it, vi } from 'vitest';
import { fetchBlobHead } from './blobs.js';

describe('fetchBlobHead', () => {
    function clientStreaming(stream: ReadableStream<Uint8Array>): VertesiaClient {
        return { files: { downloadFile: vi.fn(async () => stream) } } as unknown as VertesiaClient;
    }

    function chunked(data: Buffer, chunkSize: number): ReadableStream<Uint8Array> {
        let offset = 0;
        return new ReadableStream({
            pull(controller) {
                if (offset >= data.length) {
                    controller.close();
                    return;
                }
                controller.enqueue(new Uint8Array(data.subarray(offset, offset + chunkSize)));
                offset += chunkSize;
            },
        });
    }

    it('should return the same prefix as slicing the whole blob, for every chunking and limit', async () => {
        const data = Buffer.from(Array.from({ length: 23 }, (_, index) => index));
        for (let chunkSize = 1; chunkSize <= data.length + 1; chunkSize++) {
            for (let maxBytes = 0; maxBytes <= data.length + 2; maxBytes++) {
                const head = await fetchBlobHead(clientStreaming(chunked(data, chunkSize)), 'gs://b/s', maxBytes);
                expect(head.data).toEqual(data.subarray(0, maxBytes));
                expect(head.truncated).toBe(data.length > maxBytes);
            }
        }
    });

    it('should stop reading an endless blob once it has the bytes it needs', async () => {
        let pulls = 0;
        const cancel = vi.fn();
        const endless = new ReadableStream<Uint8Array>({
            pull(controller) {
                pulls++;
                controller.enqueue(new Uint8Array(1024));
            },
            cancel,
        });

        const head = await fetchBlobHead(clientStreaming(endless), 'gs://b/s', 4096);

        expect(head).toMatchObject({ truncated: true });
        expect(head.data.length).toBe(4096);
        expect(cancel).toHaveBeenCalledOnce();
        expect(pulls).toBeLessThan(10);
    });
});
