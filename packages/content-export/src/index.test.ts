import { describe, expect, it, vi } from 'vitest';
import {
    compactTimestamp,
    createContentExportFilename,
    createContentExportStream,
    iterateContentExportRecords,
} from './index.js';

describe('content export helpers', () => {
    it('iterates paged export records', async () => {
        const exportPage = vi
            .fn()
            .mockResolvedValueOnce({
                items: [
                    {
                        id: 'object-1',
                        name: 'Object 1',
                        created_at: '2026-01-01T00:00:00.000Z',
                        updated_at: '2026-01-01T00:00:00.000Z',
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
                items: [
                    {
                        id: 'object-2',
                        name: 'Object 2',
                        created_at: '2026-01-01T00:00:00.000Z',
                        updated_at: '2026-01-01T00:00:00.000Z',
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
        const client = { objects: { exportPage } };

        const records = [];
        for await (const record of iterateContentExportRecords(client, { include: { embeddings: true } })) {
            records.push(record);
        }

        expect(records.map((record) => record.id)).toEqual(['object-1', 'object-2']);
        expect(exportPage).toHaveBeenNthCalledWith(1, {
            include: { embeddings: true },
            cursor: undefined,
        });
        expect(exportPage).toHaveBeenNthCalledWith(2, {
            include: { embeddings: true },
            cursor: 'cursor-2',
        });
    });

    it('creates an uncompressed JSONL stream', async () => {
        const client = {
            objects: {
                exportPage: vi.fn().mockResolvedValue({
                    items: [
                        {
                            id: 'object-1',
                            name: 'Object 1',
                            created_at: '2026-01-01T00:00:00.000Z',
                            updated_at: '2026-01-01T00:00:00.000Z',
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

        const result = createContentExportStream(client, {
            compression: 'none',
            filename: 'embeddings',
            include: { embeddings: true },
        });
        const output = await readStream(result.stream);

        expect(result.filename).toBe('embeddings.jsonl');
        expect(result.content_type).toBe('application/x-ndjson');
        expect(output.trim()).toBe(
            '{"id":"object-1","name":"Object 1","created_at":"2026-01-01T00:00:00.000Z","updated_at":"2026-01-01T00:00:00.000Z","embeddings":{"text":{"model":"text-model","values":[1,2,3]}}}',
        );
    });

    it('creates compact project export filenames', () => {
        const date = new Date(2026, 4, 6, 18, 54, 22);

        expect(compactTimestamp(date)).toBe('20260506185422');
        expect(
            createContentExportFilename(
                {
                    id: '670f9ec8f036f3d24a4ca5e5',
                    name: 'LR Testing / Local',
                },
                date,
            ),
        ).toBe('content-export-670f9ec8f036f3d24a4ca5e5-LR-Testing-Local-20260506185422');
    });

    it('caps long project names in export filenames', () => {
        const date = new Date(2026, 4, 6, 18, 54, 22);
        const filename = createContentExportFilename(
            {
                id: 'project-id',
                name: `${'a'.repeat(120)} tail`,
            },
            date,
        );

        expect(filename).toBe(`content-export-project-id-${'a'.repeat(80)}-20260506185422`);
    });

    it('uses project metadata in default stream filenames', () => {
        const client = {
            objects: {
                exportPage: vi.fn(),
            },
        };

        const result = createContentExportStream(client, {
            compression: 'gzip',
            include: { embeddings: true },
            project: {
                id: 'project-id',
                name: 'Project Name',
            },
        });

        expect(result.filename).toMatch(/^content-export-project-id-Project-Name-\d{14}\.jsonl\.gz$/);
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
