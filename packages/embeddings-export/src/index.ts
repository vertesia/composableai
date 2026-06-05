import type { ZenoClient } from '@vertesia/client';
import type {
    ExportEmbeddingsPageRequest,
    ExportEmbeddingsPageResponse,
    ExportedEmbeddingRecord,
} from '@vertesia/common';

export type EmbeddingsExportCompression = 'gzip' | 'none';

export interface EmbeddingsExportProgress {
    pages: number;
    records: number;
    cursor?: string;
    done: boolean;
}

export interface EmbeddingsExportStreamOptions extends ExportEmbeddingsPageRequest {
    /**
     * Compress the JSONL stream with gzip. Defaults to gzip.
     */
    compression?: EmbeddingsExportCompression;
    /**
     * Suggested filename base. The helper appends .jsonl or .jsonl.gz.
     */
    filename?: string;
    /**
     * Project id/name used by the default filename when filename is omitted.
     */
    project?: EmbeddingsExportFilenameProject;
    /**
     * Called after each fetched page and once at completion.
     */
    onProgress?: (progress: EmbeddingsExportProgress) => void;
    /**
     * Stops page fetching before the next request.
     */
    signal?: AbortSignal;
}

export interface EmbeddingsExportStreamResult {
    stream: ReadableStream<Uint8Array>;
    filename: string;
    content_type: string;
    compression: EmbeddingsExportCompression;
}

export interface EmbeddingsExportFilenameProject {
    id?: string;
    name?: string;
}

type EmbeddingsExportClient = Pick<ZenoClient, 'embeddings'>;
const MAX_PROJECT_NAME_FILENAME_LENGTH = 80;

export async function* iterateEmbeddingExportPages(
    client: EmbeddingsExportClient,
    request: ExportEmbeddingsPageRequest = {},
    options: { signal?: AbortSignal; onProgress?: (progress: EmbeddingsExportProgress) => void } = {},
): AsyncGenerator<ExportEmbeddingsPageResponse> {
    let cursor = request.cursor;
    let pages = 0;
    let records = 0;

    while (true) {
        throwIfAborted(options.signal);
        const page = await client.embeddings.exportPage({
            ...request,
            cursor,
        });
        pages++;
        records += page.exported_count;
        cursor = page.next_cursor;
        options.onProgress?.({
            pages,
            records,
            cursor,
            done: !page.has_more,
        });
        yield page;
        if (!page.has_more) {
            break;
        }
    }
}

export async function* iterateEmbeddingExportRecords(
    client: EmbeddingsExportClient,
    request: ExportEmbeddingsPageRequest = {},
    options: { signal?: AbortSignal; onProgress?: (progress: EmbeddingsExportProgress) => void } = {},
): AsyncGenerator<ExportedEmbeddingRecord> {
    for await (const page of iterateEmbeddingExportPages(client, request, options)) {
        for (const item of page.items) {
            yield item;
        }
    }
}

export function createEmbeddingsExportStream(
    client: EmbeddingsExportClient,
    options: EmbeddingsExportStreamOptions = {},
): EmbeddingsExportStreamResult {
    const {
        compression = 'gzip',
        filename = createEmbeddingsExportFilename(options.project),
        onProgress,
        signal,
        project: _project,
        ...request
    } = options;
    const jsonlStream = createJsonlStream(client, request, { signal, onProgress });
    const stream = compression === 'gzip' ? gzipStream(jsonlStream) : jsonlStream;
    const extension = compression === 'gzip' ? '.jsonl.gz' : '.jsonl';

    return {
        stream,
        filename: filename.endsWith(extension) ? filename : `${filename}${extension}`,
        content_type: compression === 'gzip' ? 'application/gzip' : 'application/x-ndjson',
        compression,
    };
}

function createJsonlStream(
    client: EmbeddingsExportClient,
    request: ExportEmbeddingsPageRequest,
    options: { signal?: AbortSignal; onProgress?: (progress: EmbeddingsExportProgress) => void },
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const iterator = iterateEmbeddingExportRecords(client, request, options);

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            throwIfAborted(options.signal);
            const next = await iterator.next();
            if (next.done) {
                controller.close();
                return;
            }
            controller.enqueue(encoder.encode(`${JSON.stringify(next.value)}\n`));
        },
        async cancel() {
            await iterator.return(undefined);
        },
    });
}

function gzipStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    if (typeof CompressionStream === 'undefined') {
        throw new Error('gzip compression requires CompressionStream support; pass compression: "none" to disable it.');
    }
    const compressionStream = new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
    return stream.pipeThrough(compressionStream);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error('Embeddings export was aborted');
    }
}

export function createEmbeddingsExportFilename(project?: EmbeddingsExportFilenameProject, date = new Date()): string {
    const parts = [
        'embed-export',
        sanitizeFilenamePart(project?.id),
        sanitizeFilenamePart(project?.name, MAX_PROJECT_NAME_FILENAME_LENGTH),
        compactTimestamp(date),
    ];
    return parts.filter(Boolean).join('-');
}

export function compactTimestamp(date = new Date()): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return [
        date.getFullYear().toString(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join('');
}

function sanitizeFilenamePart(value: string | undefined, maxLength?: number): string | undefined {
    const normalized = value
        ?.trim()
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    if (!normalized) {
        return undefined;
    }
    if (!maxLength || normalized.length <= maxLength) {
        return normalized;
    }
    return normalized.slice(0, maxLength).replace(/^-|-$/g, '') || undefined;
}
