import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import type { UploadSession } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamSource } from '../StreamSource.js';
import {
    type MultipartUploadApi,
    partsAsUploadBody,
    planUpload,
    UPLOAD_PART_SIZE,
    uploadInParts,
} from './chunked-upload.js';
import { ContentLengthMismatchError } from './node-request.js';

const gcs = vi.hoisted(() => ({
    writeOptions: [] as Record<string, unknown>[],
    received: [] as Buffer[],
    finished: false,
    destroyed: undefined as Error | null | undefined,
    files: [] as { bucket: string; key: string }[],
    authClients: [] as unknown[],
}));

vi.mock('@google-cloud/storage', () => ({
    Storage: class {
        constructor(options: { authClient: unknown }) {
            gcs.authClients.push(options.authClient);
        }
        bucket(bucket: string) {
            return {
                file(key: string) {
                    gcs.files.push({ bucket, key });
                    const file: { metadata?: { md5Hash?: string }; createWriteStream: unknown } = {
                        createWriteStream(options: Record<string, unknown>) {
                            gcs.writeOptions.push(options);
                            return new Writable({
                                write(chunk: Buffer, _encoding, callback) {
                                    gcs.received.push(chunk);
                                    callback();
                                },
                                final(callback) {
                                    gcs.finished = true;
                                    file.metadata = {
                                        md5Hash: createHash('md5').update(Buffer.concat(gcs.received)).digest('base64'),
                                    };
                                    callback();
                                },
                                destroy(error, callback) {
                                    gcs.destroyed = error;
                                    callback(error);
                                },
                            });
                        },
                    };
                    return file;
                },
            };
        }
    },
}));

vi.mock('google-auth-library', () => ({ PassThroughClient: class PassThroughClient {} }));

const azure = vi.hoisted(() => ({
    urls: [] as string[],
    calls: [] as { bufferSize: number; maxConcurrency: number; options: unknown }[],
    received: [] as Buffer[],
    fail: false,
}));

vi.mock('@azure/storage-blob', () => ({
    BlockBlobClient: class {
        constructor(url: string) {
            azure.urls.push(url);
        }
        async uploadStream(
            stream: AsyncIterable<Buffer>,
            bufferSize: number,
            maxConcurrency: number,
            options: unknown,
        ) {
            azure.calls.push({ bufferSize, maxConcurrency, options });
            if (azure.fail) throw new Error('403 AuthenticationFailed');
            for await (const chunk of stream) azure.received.push(chunk);
            return { etag: '"0x8DC1"' };
        }
    },
}));

const encoder = new TextEncoder();

/** A stream of `text`, `chunk` bytes at a time. */
function textStream(text: string, chunk = 3): ReadableStream<Uint8Array> {
    const bytes = encoder.encode(text);
    let offset = 0;
    return new ReadableStream<Uint8Array>({
        pull(controller) {
            if (offset >= bytes.byteLength) {
                controller.close();
                return;
            }
            controller.enqueue(bytes.slice(offset, offset + chunk));
            offset += chunk;
        },
    });
}

/** A stream of `size` zero bytes in 1 MiB chunks, which counts how much was read. */
function zeroStream(size: number): { stream: ReadableStream<Uint8Array>; read: () => number } {
    const chunk = 1024 * 1024;
    let produced = 0;
    const stream = new ReadableStream<Uint8Array>(
        {
            pull(controller) {
                if (produced >= size) {
                    controller.close();
                    return;
                }
                const n = Math.min(chunk, size - produced);
                produced += n;
                controller.enqueue(new Uint8Array(n));
            },
        },
        { highWaterMark: 0 },
    );
    return { stream, read: () => produced };
}

const sessionFields = { id: 's3://bucket/big.bin', path: 'bucket/big.bin', mime_type: 'text/plain', part_size: 5 };

function s3Session(): UploadSession {
    return { protocol: 's3_multipart', ...sessionFields, upload_id: 'upload-1' };
}

function fakeApi(): MultipartUploadApi & {
    getUploadPartUrls: ReturnType<typeof vi.fn>;
    completeUploadSession: ReturnType<typeof vi.fn>;
    abortUploadSession: ReturnType<typeof vi.fn>;
} {
    return {
        getUploadPartUrls: vi.fn(async ({ part_numbers }: { part_numbers: number[] }) => ({
            parts: part_numbers.map((n) => ({
                part_number: n,
                url: `https://bucket.s3.amazonaws.com/big.bin?part=${n}`,
            })),
        })),
        completeUploadSession: vi.fn(async () => ({ etag: '"abc-3"' })),
        abortUploadSession: vi.fn(async () => ({ aborted: true })),
    };
}

describe('planUpload', () => {
    it('sends a File in one request', async () => {
        const file = new File(['hello'], 'a.txt');
        expect(await planUpload(file)).toEqual({ kind: 'single', upload: { body: file } });
    });

    it('sends a stream that ends within one part in one request, from memory', async () => {
        const plan = await planUpload(new StreamSource(textStream('hello world'), 'a.txt', 'text/plain'));
        expect(plan.kind).toBe('single');
        if (plan.kind !== 'single') return;
        expect(plan.upload.body).toBeInstanceOf(Blob);
        expect(await (plan.upload.body as Blob).text()).toBe('hello world');
        expect(plan.upload.contentLength).toBeUndefined();
    });

    it('sends a stream longer than one part in parts, after reading only one part', async () => {
        const size = UPLOAD_PART_SIZE * 3;
        const source = zeroStream(size);
        const plan = await planUpload(new StreamSource(source.stream, 'big.bin'));
        expect(plan.kind).toBe('parts');
        // one part and the chunk that passed it
        expect(source.read()).toBeLessThanOrEqual(UPLOAD_PART_SIZE + 1024 * 1024 * 2);
        if (plan.kind !== 'parts') return;
        expect(plan.parts.size).toBeUndefined();
        let total = 0;
        for await (const chunk of plan.parts.body as ReadableStream<Uint8Array>) total += chunk.byteLength;
        expect(total).toBe(size);
    });

    it('keeps the declared length of a long stream', async () => {
        const size = UPLOAD_PART_SIZE + 10;
        const plan = await planUpload(new StreamSource(zeroStream(size).stream, 'big.bin', undefined, undefined, size));
        expect(plan.kind).toBe('parts');
        if (plan.kind === 'parts') expect(plan.parts.size).toBe(size);
    });

    it('rejects a stream declared longer than one part that ends within it', async () => {
        const declared = UPLOAD_PART_SIZE * 2;
        const plan = planUpload(new StreamSource(textStream('short'), 'short.bin', undefined, undefined, declared));
        await expect(plan).rejects.toBeInstanceOf(ContentLengthMismatchError);
        await expect(plan).rejects.toMatchObject({ declared, actual: 5, direction: 'short' });
    });

    it('cancels the source when a chunk after the first part cannot be sent', async () => {
        let pulled = 0;
        const cancel = vi.fn();
        const stream = new ReadableStream<unknown>(
            {
                pull(controller) {
                    pulled++;
                    // an object-mode chunk once more than one part has been read
                    controller.enqueue(
                        pulled > UPLOAD_PART_SIZE / 1024 / 1024 + 1 ? { not: 'bytes' } : new Uint8Array(1024 * 1024),
                    );
                },
                cancel,
            },
            { highWaterMark: 0 },
        );
        const plan = await planUpload(new StreamSource(stream as ReadableStream, 'big.bin'));
        expect(plan.kind).toBe('parts');
        if (plan.kind !== 'parts') return;
        await expect(new Response(plan.parts.body).arrayBuffer()).rejects.toBeInstanceOf(TypeError);
        expect(cancel).toHaveBeenCalledWith(expect.any(TypeError));
    });

    it('sends a stream declared to fit in one part in one request without reading it', async () => {
        const source = zeroStream(100);
        const plan = await planUpload(new StreamSource(source.stream, 'small.bin', undefined, undefined, 100));
        expect(plan).toEqual({ kind: 'single', upload: { body: source.stream, contentLength: 100 } });
        expect(source.read()).toBe(0);
    });

    it('sends a replayable body longer than one part in parts', async () => {
        const blob = new Blob([new Uint8Array(UPLOAD_PART_SIZE + 1)]);
        const source = new (class extends StreamSource {
            override replayableBody() {
                return Promise.resolve(blob);
            }
        })(new ReadableStream(), 'big.bin');
        expect(await planUpload(source)).toEqual({ kind: 'parts', parts: { body: blob } });
    });

    it('stays on one request outside Node.js', async () => {
        const versions = process.versions;
        Object.defineProperty(process, 'versions', { value: { ...versions, node: undefined }, configurable: true });
        try {
            const stream = zeroStream(UPLOAD_PART_SIZE * 2).stream;
            const plan = await planUpload(new StreamSource(stream, 'big.bin'));
            expect(plan).toEqual({ kind: 'single', upload: { body: stream, contentLength: undefined } });
        } finally {
            Object.defineProperty(process, 'versions', { value: versions, configurable: true });
        }
    });

    it('can turn the parts back into one body', () => {
        const stream = textStream('x');
        expect(partsAsUploadBody({ body: stream, size: 1 })).toEqual({ body: stream, contentLength: 1 });
    });
});

describe('uploadInParts on S3', () => {
    let received: { url: string; body: string }[];

    beforeEach(() => {
        received = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string, init: RequestInit) => {
                received.push({ url, body: await (init.body as Blob).text() });
                return new Response(null, { status: 200, headers: { etag: `"etag-${received.length}"` } });
            }),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends each part to its signed URL and completes the upload with the ETags', async () => {
        const api = fakeApi();
        const etag = await uploadInParts(api, s3Session(), { body: textStream('hello world!', 4) });

        expect(received.map((r) => r.body)).toEqual(['hello', ' worl', 'd!']);
        expect(received[1].url).toBe('https://bucket.s3.amazonaws.com/big.bin?part=2');
        expect(api.getUploadPartUrls).toHaveBeenCalledTimes(1);
        expect(api.getUploadPartUrls.mock.calls[0][0].part_numbers).toHaveLength(100);
        expect(api.completeUploadSession).toHaveBeenCalledWith({
            id: 's3://bucket/big.bin',
            upload_id: 'upload-1',
            parts: [
                { part_number: 1, etag: '"etag-1"' },
                { part_number: 2, etag: '"etag-2"' },
                { part_number: 3, etag: '"etag-3"' },
            ],
        });
        expect(api.abortUploadSession).not.toHaveBeenCalled();
        expect(etag).toBe('abc-3');
    });

    it('slices a blob body into parts', async () => {
        await uploadInParts(fakeApi(), s3Session(), { body: new Blob(['0123456789ab']) });
        expect(received.map((r) => r.body)).toEqual(['01234', '56789', 'ab']);
    });

    it('signs part URLs 100 at a time, as they are needed', async () => {
        const api = fakeApi();
        await uploadInParts(api, s3Session(), { body: new Blob([new Uint8Array(5 * 101)]) });
        expect(api.getUploadPartUrls.mock.calls.map((call) => call[0].part_numbers[0])).toEqual([1, 101]);
        expect(api.getUploadPartUrls.mock.calls[0][0].part_numbers).toHaveLength(100);
        expect(api.completeUploadSession.mock.calls[0][0].parts).toHaveLength(101);
    });

    it('refuses a protocol it does not know, before reading anything', async () => {
        const body = textStream('hello');
        const session = { ...s3Session(), protocol: 'r2_multipart' } as unknown as UploadSession;
        await expect(uploadInParts(fakeApi(), session, { body })).rejects.toThrow('the r2_multipart protocol');
        expect(body.locked).toBe(false);
    });

    it('signs the URLs again once they are old', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            const api = fakeApi();
            let slow = true;
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => {
                    // the first part takes longer than a URL should be kept
                    if (slow) vi.setSystemTime(Date.now() + 16 * 60_000);
                    slow = false;
                    return new Response(null, { status: 200, headers: { etag: '"e"' } });
                }),
            );
            await uploadInParts(api, s3Session(), { body: new Blob(['0123456789']) });
            expect(api.getUploadPartUrls.mock.calls.map((call) => call[0].part_numbers[0])).toEqual([1, 2]);
        } finally {
            vi.useRealTimers();
        }
    });

    it('signs a part URL again when it is refused, once', async () => {
        let attempts = 0;
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                attempts++;
                return attempts === 1
                    ? new Response('Request has expired', { status: 403 })
                    : new Response(null, { status: 200, headers: { etag: `"e${attempts}"` } });
            }),
        );
        const api = fakeApi();
        await uploadInParts(api, s3Session(), { body: new Blob(['01234']) });
        expect(api.getUploadPartUrls).toHaveBeenCalledTimes(2);
        expect(api.completeUploadSession.mock.calls[0][0].parts).toEqual([{ part_number: 1, etag: '"e2"' }]);
    });

    it('sizes the parts of a declared length to fit in 10,000 parts', async () => {
        const api = fakeApi();
        const size = 10_000 * 5 + 1;
        const session = { ...s3Session(), part_size: 5 };
        // 1 MiB parts, since 5 bytes would need 10,001 of them: the whole length fits in one
        await uploadInParts(api, session, { body: new Blob([new Uint8Array(size)]) });
        expect(received.map((r) => r.body.length)).toEqual([size]);
    });

    it('grows the parts of a stream of unknown length every 2,000 parts', async () => {
        const api = fakeApi();
        const session = { ...s3Session(), part_size: 1 };
        const total = 2_000 + 2 * 3;
        await uploadInParts(api, session, { body: textStream('x'.repeat(total), 7) });
        const sizes = received.map((r) => r.body.length);
        expect(sizes.slice(0, 2_000).every((n) => n === 1)).toBe(true);
        expect(sizes.slice(2_000)).toEqual([2, 2, 2]);
    });

    it('refuses a declared length over the 5 TiB S3 limit before sending anything', async () => {
        const api = fakeApi();
        const size = 5 * 1024 ** 4 + 1;
        await expect(uploadInParts(api, s3Session(), { body: textStream('x'), size })).rejects.toThrow('5 TiB');
        expect(received).toEqual([]);
        expect(api.abortUploadSession).toHaveBeenCalled();
    });

    it('aborts the upload when a part fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('denied', { status: 403, statusText: 'Forbidden' })),
        );
        const api = fakeApi();
        await expect(uploadInParts(api, s3Session(), { body: textStream('hello world') })).rejects.toThrow(
            'Failed to upload part 1: 403 Forbidden denied',
        );
        expect(api.completeUploadSession).not.toHaveBeenCalled();
        expect(api.abortUploadSession).toHaveBeenCalledWith({ id: 's3://bucket/big.bin', upload_id: 'upload-1' });
    });

    it.each([
        ['ends short of', 20, 'short'],
        ['runs past', 8, 'long'],
    ])('aborts instead of completing a stream that %s its declared length', async (_name, size, direction) => {
        const api = fakeApi();
        const upload = uploadInParts(api, s3Session(), { body: textStream('hello world!'), size });
        await expect(upload).rejects.toBeInstanceOf(ContentLengthMismatchError);
        await expect(upload).rejects.toMatchObject({ direction });
        expect(api.completeUploadSession).not.toHaveBeenCalled();
        expect(api.abortUploadSession).toHaveBeenCalled();
    });

    it('stops reading the source when a part fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(null, { status: 400 })),
        );
        const source = zeroStream(1024 * 1024 * 50);
        const session = { ...s3Session(), part_size: 1024 * 1024 };
        await expect(uploadInParts(fakeApi(), session, { body: source.stream })).rejects.toThrow();
        expect(source.read()).toBeLessThanOrEqual(1024 * 1024 * 3);
    });
});

describe('uploadInParts on Google Cloud Storage', () => {
    beforeEach(() => {
        gcs.writeOptions = [];
        gcs.received = [];
        gcs.finished = false;
        gcs.destroyed = undefined;
        gcs.files = [];
        gcs.authClients = [];
    });

    const session: UploadSession = {
        protocol: 'gcs_resumable',
        ...sessionFields,
        id: 'gs://bucket/dir/big.bin',
        path: 'bucket/dir/big.bin',
        url: 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadType=resumable&upload_id=x',
    };

    it('writes the content to the session URI in chunks of the part size, with no credentials', async () => {
        const etag = await uploadInParts(fakeApi(), session, { body: textStream('hello world'), size: 11 });

        expect(gcs.files).toEqual([{ bucket: 'bucket', key: 'dir/big.bin' }]);
        expect(gcs.authClients[0]?.constructor.name).toBe('PassThroughClient');
        expect(gcs.writeOptions[0]).toMatchObject({ uri: session.url, resumable: true, chunkSize: 5 });
        expect(Buffer.concat(gcs.received).toString()).toBe('hello world');
        expect(gcs.finished).toBe(true);
        expect(etag).toBe(createHash('md5').update('hello world').digest('hex'));
    });

    it.each([
        ['ends short of', 20],
        ['runs past', 8],
    ])('never finishes the object from a stream that %s its declared length', async (_name, size) => {
        await expect(
            uploadInParts(fakeApi(), session, { body: textStream('hello world'), size }),
        ).rejects.toBeInstanceOf(ContentLengthMismatchError);
        expect(gcs.finished).toBe(false);
        expect(gcs.destroyed).toBeInstanceOf(ContentLengthMismatchError);
    });
});

describe('uploadInParts on Azure Blob Storage', () => {
    beforeEach(() => {
        azure.urls = [];
        azure.calls = [];
        azure.received = [];
        azure.fail = false;
    });

    const session: UploadSession = {
        protocol: 'azure_block_blob',
        ...sessionFields,
        id: 'az://container/big.bin',
        path: 'container/big.bin',
        url: 'https://account.blob.core.windows.net/container/big.bin?sv=x&sig=y',
    };

    it('uploads blocks of the part size one at a time and commits them with the content type', async () => {
        const etag = await uploadInParts(fakeApi(), session, { body: new Blob(['hello world']) });

        expect(azure.urls).toEqual([session.url]);
        expect(azure.calls).toEqual([
            { bufferSize: 5, maxConcurrency: 1, options: { blobHTTPHeaders: { blobContentType: 'text/plain' } } },
        ]);
        expect(Buffer.concat(azure.received).toString()).toBe('hello world');
        expect(etag).toBe('0x8DC1');
    });

    it('cancels the source when the upload fails', async () => {
        azure.fail = true;
        let cancelled = false;
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                controller.enqueue(new Uint8Array(1024));
            },
            cancel() {
                cancelled = true;
            },
        });
        await expect(uploadInParts(fakeApi(), session, { body })).rejects.toThrow('403');
        await vi.waitFor(() => expect(cancelled).toBe(true));
    });

    it('fails the upload, before it is committed, for a stream short of its declared length', async () => {
        await expect(
            uploadInParts(fakeApi(), session, { body: textStream('hello world'), size: 12 }),
        ).rejects.toBeInstanceOf(ContentLengthMismatchError);
    });
});
