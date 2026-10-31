import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import {
    ContentEventName,
    type ContentObject,
    type DSLActivityExecutionPayload,
    EXTRACTED_TEXT_TRUNCATION_MARKER,
    MAX_EXTRACTED_TEXT_BYTES,
    truncateExtractedText,
} from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mutoolPdfToText } from '../conversion/mutool.js';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../errors.js';
import { TextExtractionStatus } from '../result-types.js';
import { fetchBlobHead } from '../utils/blobs.js';
import { type ExtractDocumentTextParams, extractDocumentText } from './extractDocumentText.js';

vi.mock('../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

vi.mock('../utils/blobs.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../utils/blobs.js')>();
    return { ...actual, fetchBlobHead: vi.fn() };
});

vi.mock('../conversion/mutool.js', () => ({ mutoolPdfToText: vi.fn(async () => 'pdf text') }));

vi.mock('../utils/tokens.js', () => ({
    countTokens: vi.fn(() => ({ count: 2, encoding: 'cl100k_base' })),
}));

let testEnv: MockActivityEnvironment;

beforeAll(() => {
    testEnv = new MockActivityEnvironment();
});

const retrieve = vi.fn();
const setObjectText = vi.fn();
const update = vi.fn();

const SOURCE = 'gs://bucket/doc.txt';

beforeEach(async () => {
    vi.clearAllMocks();
    const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
    const client = {
        objects: {
            retrieve,
            setObjectText,
            update,
        },
    } as unknown as VertesiaClient;
    vi.mocked(setupActivity).mockResolvedValue({
        client,
        inputType: 'objectIds',
        objectId: 'object-1',
        objectIds: ['object-1'],
        params: {},
    } as unknown as ActivityContext<ExtractDocumentTextParams>);
    serveSource(Buffer.from('hello world', 'utf8'));
});

/** Serve `source` as the blob: fetchBlobHead returns its first `maxBytes`, as the real one does. */
function serveSource(source: Buffer) {
    vi.mocked(fetchBlobHead).mockImplementation(async (_client, _uri, maxBytes) => ({
        data: source.subarray(0, maxBytes),
        truncated: source.length > maxBytes,
    }));
}

function requestedBytes(): number | undefined {
    return vi.mocked(fetchBlobHead).mock.calls[0]?.[2];
}

function createDoc(overrides: Partial<ContentObject> = {}): ContentObject {
    return {
        id: 'object-1',
        content: {
            type: 'text/plain',
            source: SOURCE,
            etag: 'etag-1',
        },
        ...overrides,
    } as ContentObject;
}

function createPayload(): DSLActivityExecutionPayload<ExtractDocumentTextParams> {
    return {
        auth_token: 'test-token',
        account_id: 'test-account',
        project_id: 'test-project',
        params: {},
        config: { studio_url: 'http://test-studio', store_url: 'http://test-store' },
        workflow_name: 'StandardIntake',
        event: ContentEventName.create,
        objectIds: ['object-1'],
        vars: {},
        activity: { name: 'extractDocumentText', params: {} },
    };
}

describe('extractDocumentText', () => {
    it('stores extracted text through setObjectText and keeps tokens on the object', async () => {
        retrieve.mockResolvedValue(createDoc());
        setObjectText.mockResolvedValue({ text: 'hello world' });
        update.mockResolvedValue({});

        await expect(testEnv.run(extractDocumentText, createPayload())).resolves.toMatchObject({
            status: TextExtractionStatus.success,
            objectId: 'object-1',
            hasText: true,
            len: 'hello world'.length,
        });

        expect(setObjectText).toHaveBeenCalledExactlyOnceWith('object-1', {
            text: 'hello world',
            etag: 'etag-1',
        });
        // The object update no longer carries text/text_etag — only token counts.
        expect(update).toHaveBeenCalledExactlyOnceWith('object-1', {
            tokens: expect.objectContaining({ etag: 'etag-1' }),
        });
    });

    it('stores a marked UTF-8-safe prefix when extracted text exceeds the limit', async () => {
        retrieve.mockResolvedValue(createDoc());
        serveSource(Buffer.from('x'.repeat(MAX_EXTRACTED_TEXT_BYTES + 1)));
        setObjectText.mockResolvedValue({});
        update.mockResolvedValue({});

        await expect(testEnv.run(extractDocumentText, createPayload())).resolves.toMatchObject({
            status: TextExtractionStatus.success,
            hasText: true,
        });

        const storedText = setObjectText.mock.calls[0]?.[1].text;
        expect(storedText?.endsWith(EXTRACTED_TEXT_TRUNCATION_MARKER)).toBe(true);
        expect(Buffer.byteLength(storedText ?? '', 'utf8')).toBe(MAX_EXTRACTED_TEXT_BYTES);
    });

    it('skips extraction when the text is current for the content etag', async () => {
        retrieve.mockResolvedValue(createDoc({ text: 'already there', text_etag: 'etag-1' }));

        await expect(testEnv.run(extractDocumentText, createPayload())).resolves.toMatchObject({
            status: TextExtractionStatus.skipped,
            message: 'Text already extracted',
        });

        expect(setObjectText).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('fails the activity when setObjectText fails', async () => {
        retrieve.mockResolvedValue(createDoc());
        setObjectText.mockRejectedValue(new Error('PUT /objects/object-1/text failed'));

        await expect(testEnv.run(extractDocumentText, createPayload())).rejects.toMatchObject({
            message: expect.stringContaining('PUT /objects/object-1/text failed'),
        });
        expect(update).not.toHaveBeenCalled();
    });

    // Regression: a transient blob-download failure used to be caught and returned as
    // `status: error`. Because the activity *resolved*, Temporal never retried it, intake
    // continued, and the object was marked `completed` with no text — permanently text-less
    // but indistinguishable from a healthy document. It must reject so the retry policy applies.
    it('rejects on a transient download failure instead of resolving with status error', async () => {
        retrieve.mockResolvedValue(createDoc());
        vi.mocked(fetchBlobHead).mockRejectedValue(new Error(`Failed to download blob ${SOURCE}: Bad Gateway`));

        await expect(testEnv.run(extractDocumentText, createPayload())).rejects.toThrow(/Bad Gateway/);

        // The defining symptom of the old behaviour: the object was still written/completed.
        expect(setObjectText).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    // Not-found/forbidden are classified as non-retryable by fetchBlobAsStream. That
    // classification must survive too — retrying a deleted blob five times helps nobody.
    it('propagates a non-retryable DocumentNotFoundError unchanged', async () => {
        retrieve.mockResolvedValue(createDoc());
        vi.mocked(fetchBlobHead).mockRejectedValue(new DocumentNotFoundError(`Not found at ${SOURCE}: not found`, []));

        await expect(testEnv.run(extractDocumentText, createPayload())).rejects.toMatchObject({
            nonRetryable: true,
        });
        expect(setObjectText).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    describe('bounded reads', () => {
        const MiB = 1024 * 1024;

        // Each alignment is an independent 10 MiB fixture. Separate cases preserve the full Unicode
        // matrix without making all nine activity executions share one test's timeout on busy runners.
        const textBoundaryCases = ['é', '€', '😀'].flatMap((char) =>
            Array.from({ length: Buffer.byteLength(char) }, (_unused, shift) => ({ char, shift })),
        );
        it.each(textBoundaryCases)(
            'reads one byte past the limit and matches a full read: $char alignment $shift',
            async ({ char, shift }) => {
                const filler = 'a'.repeat(MAX_EXTRACTED_TEXT_BYTES - 64 + shift);
                const full = filler + char.repeat(40) + 'tail'.repeat(1000);
                retrieve.mockResolvedValue(createDoc());
                setObjectText.mockResolvedValue({});
                update.mockResolvedValue({});
                serveSource(Buffer.from(full, 'utf8'));

                await testEnv.run(extractDocumentText, createPayload());

                expect(requestedBytes()).toBe(MAX_EXTRACTED_TEXT_BYTES + 1);
                expect(setObjectText.mock.calls[0]?.[1].text).toBe(truncateExtractedText(full).text);
            },
        );

        it('reads an unknown type only as far as it can be sniffed, and skips a larger one as before', async () => {
            retrieve.mockResolvedValue(createDoc({ content: { type: 'application/mxf', source: SOURCE, etag: 'e' } }));
            // Text-like bytes: before, a file this large was never sniffed either.
            serveSource(Buffer.from('a'.repeat(600 * 1024)));

            await expect(testEnv.run(extractDocumentText, createPayload())).resolves.toMatchObject({
                status: TextExtractionStatus.skipped,
                message: 'Unsupported mime type: application/mxf',
            });
            expect(requestedBytes()).toBe(500 * 1024 + 1);
            expect(setObjectText).not.toHaveBeenCalled();
        });

        it('treats a type named like an Object.prototype member as an unknown type', async () => {
            for (const type of ['toString', 'constructor', '__proto__']) {
                vi.clearAllMocks();
                retrieve.mockResolvedValue(createDoc({ content: { type, source: SOURCE, etag: 'e' } }));
                setObjectText.mockResolvedValue({});
                update.mockResolvedValue({});

                await testEnv.run(extractDocumentText, createPayload());

                expect(requestedBytes()).toBe(500 * 1024 + 1);
                expect(setObjectText).toHaveBeenCalledExactlyOnceWith('object-1', { text: 'hello world', etag: 'e' });
            }
        });

        it('still extracts a small unknown type that sniffs as text', async () => {
            retrieve.mockResolvedValue(createDoc({ content: { type: 'text/x-log', source: SOURCE, etag: 'e' } }));
            setObjectText.mockResolvedValue({});
            update.mockResolvedValue({});
            serveSource(Buffer.from('line one\nline two\n'));

            await expect(testEnv.run(extractDocumentText, createPayload())).resolves.toMatchObject({
                status: TextExtractionStatus.success,
            });
            expect(setObjectText).toHaveBeenCalledExactlyOnceWith('object-1', {
                text: 'line one\nline two\n',
                etag: 'e',
            });
        });

        it('hands a converter source within the limit to the converter', async () => {
            retrieve.mockResolvedValue(createDoc({ content: { type: 'application/pdf', source: SOURCE, etag: 'e' } }));
            setObjectText.mockResolvedValue({});
            update.mockResolvedValue({});
            serveSource(Buffer.from('%PDF-1.7'));

            await expect(testEnv.run(extractDocumentText, createPayload())).resolves.toMatchObject({
                status: TextExtractionStatus.success,
            });
            expect(requestedBytes()).toBe(1024 * MiB);
            expect(mutoolPdfToText).toHaveBeenCalledExactlyOnceWith(Buffer.from('%PDF-1.7'));
        });

        it('skips a converter source over the limit without converting it, and does not fail', async () => {
            retrieve.mockResolvedValue(createDoc({ content: { type: 'application/pdf', source: SOURCE, etag: 'e' } }));
            vi.mocked(fetchBlobHead).mockResolvedValue({ data: Buffer.alloc(0), truncated: true });

            await expect(testEnv.run(extractDocumentText, createPayload())).resolves.toMatchObject({
                status: TextExtractionStatus.skipped,
                message: 'Source too large for text extraction: over 1024 MiB',
            });
            expect(mutoolPdfToText).not.toHaveBeenCalled();
            expect(setObjectText).not.toHaveBeenCalled();
        });

        it('skips an oversized converter source in file mode', async () => {
            const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
            vi.mocked(setupActivity).mockResolvedValue({
                client: {} as VertesiaClient,
                inputType: 'files',
                file: { url: 'gs://bucket/big.pdf', mimetype: 'application/pdf' },
                params: { output_storage_path: 'out/text.md' },
            } as unknown as ActivityContext<ExtractDocumentTextParams>);
            vi.mocked(fetchBlobHead).mockResolvedValue({ data: Buffer.alloc(0), truncated: true });

            await expect(testEnv.run(extractDocumentText, createPayload())).resolves.toMatchObject({
                status: TextExtractionStatus.skipped,
                hasText: false,
                message: 'Source too large for text extraction: over 1024 MiB',
                file: { source_url: 'gs://bucket/big.pdf' },
            });
            expect(mutoolPdfToText).not.toHaveBeenCalled();
        });
    });
});
