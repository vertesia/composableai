import type { ZenoClient } from '@vertesia/client';
import type {
    ExportContentObjectsPageRequest,
    ExportContentObjectsPageResponse,
    ExportedContentObjectRecord,
} from '@vertesia/common';

export type ContentExportCompression = 'gzip' | 'none';

export interface ContentExportProgress {
    pages: number;
    records: number;
    cursor?: string;
    done: boolean;
}

export interface ContentExportStreamOptions extends ExportContentObjectsPageRequest {
    /**
     * Compress the JSONL stream with gzip. Defaults to gzip.
     */
    compression?: ContentExportCompression;
    /**
     * Suggested filename base. The helper appends .jsonl or .jsonl.gz.
     */
    filename?: string;
    /**
     * Project id/name used by the default filename when filename is omitted.
     */
    project?: ContentExportFilenameProject;
    /**
     * Called after each fetched page and once at completion.
     */
    onProgress?: (progress: ContentExportProgress) => void;
    /**
     * Stops page fetching before the next request.
     */
    signal?: AbortSignal;
}

export interface ContentExportStreamResult {
    stream: ReadableStream<Uint8Array>;
    filename: string;
    content_type: string;
    compression: ContentExportCompression;
}

export interface ContentExportFilenameProject {
    id?: string;
    name?: string;
}

type ContentExportClient = Pick<ZenoClient, 'objects'>;
const MAX_PROJECT_NAME_FILENAME_LENGTH = 80;

export async function* iterateContentExportPages(
    client: ContentExportClient,
    request: ExportContentObjectsPageRequest = {},
    options: { signal?: AbortSignal; onProgress?: (progress: ContentExportProgress) => void } = {},
): AsyncGenerator<ExportContentObjectsPageResponse> {
    let cursor = request.cursor;
    let pages = 0;
    let records = 0;

    while (true) {
        throwIfAborted(options.signal);
        const page = await client.objects.exportPage({
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

export async function* iterateContentExportRecords(
    client: ContentExportClient,
    request: ExportContentObjectsPageRequest = {},
    options: { signal?: AbortSignal; onProgress?: (progress: ContentExportProgress) => void } = {},
): AsyncGenerator<ExportedContentObjectRecord> {
    for await (const page of iterateContentExportPages(client, request, options)) {
        for (const item of page.items) {
            yield item;
        }
    }
}

export function createContentExportStream(
    client: ContentExportClient,
    options: ContentExportStreamOptions = {},
): ContentExportStreamResult {
    const {
        compression = 'gzip',
        filename = createContentExportFilename(options.project),
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
    client: ContentExportClient,
    request: ExportContentObjectsPageRequest,
    options: { signal?: AbortSignal; onProgress?: (progress: ContentExportProgress) => void },
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const iterator = iterateContentExportRecords(client, request, options);

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
        throw signal.reason instanceof Error ? signal.reason : new Error('Content export was aborted');
    }
}

export function createContentExportFilename(project?: ContentExportFilenameProject, date = new Date()): string {
    const parts = [
        'content-export',
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
