import { describe, expect, it, vi } from 'vitest';
import { createEmbeddingsExportStream, iterateEmbeddingExportRecords } from './index.js';

describe('embeddings export helpers', () => {
    it('iterates paged export records', async () => {
        const exportPage = vi
            .fn()
            .mockResolvedValueOnce({
                schema_version: 1,
                items: [
                    {
                        object: {
                            id: 'object-1',
                            name: 'Object 1',
                            location: '/',
                            created_at: '2026-01-01T00:00:00.000Z',
                            updated_at: '2026-01-01T00:00:00.000Z',
                        },
                        embeddings: {
                            text: {
                                model: 'text-model',
                                values: [1, 2, 3],
                            },
                        },
                    },
                ],
                has_more: true,
                next_cursor: 'cursor-2',
                exported_count: 1,
            })
            .mockResolvedValueOnce({
                schema_version: 1,
                items: [
                    {
                        object: {
                            id: 'object-2',
                            name: 'Object 2',
                            location: '/',
                            created_at: '2026-01-01T00:00:00.000Z',
                            updated_at: '2026-01-01T00:00:00.000Z',
                        },
                        embeddings: {
                            image: {
                                model: 'image-model',
                                values: [4, 5, 6],
                            },
                        },
                    },
                ],
                has_more: false,
                exported_count: 1,
            });
        const client = { embeddings: { exportPage } };

        const records = [];
        for await (const record of iterateEmbeddingExportRecords(client, { limit: 1 })) {
            records.push(record);
        }

        expect(records.map((record) => record.object.id)).toEqual(['object-1', 'object-2']);
        expect(exportPage).toHaveBeenNthCalledWith(1, { limit: 1, cursor: undefined });
        expect(exportPage).toHaveBeenNthCalledWith(2, { limit: 1, cursor: 'cursor-2' });
    });

    it('creates an uncompressed JSONL stream', async () => {
        const client = {
            embeddings: {
                exportPage: vi.fn().mockResolvedValue({
                    schema_version: 1,
                    items: [
                        {
                            object: {
                                id: 'object-1',
                                name: 'Object 1',
                                location: '/',
                                created_at: '2026-01-01T00:00:00.000Z',
                                updated_at: '2026-01-01T00:00:00.000Z',
                            },
                            embeddings: {
                                text: {
                                    model: 'text-model',
                                    values: [1, 2, 3],
                                },
                            },
                        },
                    ],
                    has_more: false,
                    exported_count: 1,
                }),
            },
        };

        const result = createEmbeddingsExportStream(client, {
            compression: 'none',
            filename: 'embeddings',
        });
        const output = await readStream(result.stream);

        expect(result.filename).toBe('embeddings.jsonl');
        expect(result.content_type).toBe('application/x-ndjson');
        expect(output.trim()).toBe(
            '{"object":{"id":"object-1","name":"Object 1","location":"/","created_at":"2026-01-01T00:00:00.000Z","updated_at":"2026-01-01T00:00:00.000Z"},"embeddings":{"text":{"model":"text-model","values":[1,2,3]}}}',
        );
    });
});

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
        const next = await reader.read();
        if (next.done) {
            break;
        }
        chunks.push(next.value);
    }
    const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(output);
}
