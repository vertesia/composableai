import { log } from '@temporalio/activity';
import type { VertesiaClient } from '@vertesia/client';
import type { ContentObject, DSLActivityExecutionPayload, DSLActivitySpec, WorkflowInputFile } from '@vertesia/common';
import { MAX_EXTRACTED_TEXT_BYTES, truncateExtractedText } from '@vertesia/common';
import { markdownWithMarkitdown } from '../conversion/markitdown.js';
import { mutoolPdfToText } from '../conversion/mutool.js';
import { markdownWithPandoc } from '../conversion/pandoc.js';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../errors.js';
import { type TextExtractionResult, TextExtractionStatus } from '../result-types.js';
import { fetchBlobHead, md5 } from '../utils/blobs.js';
import { createFileSourceResult, uploadTextPreviewToStorage } from '../utils/text-preview-utils.js';
import { countTokens } from '../utils/tokens.js';
import { initializeActivityCommandDeadline } from './media/exec.js';

//@ts-expect-error
const _JSON: DSLActivitySpec = {
    name: 'extractDocumentText',
};

export interface ExtractDocumentTextParams {
    output_storage_path?: string;
}
export interface ExtractDocumentText extends DSLActivitySpec<ExtractDocumentTextParams> {
    name: 'extractDocumentText';
    projection?: never;
}

export async function extractDocumentText(
    payload: DSLActivityExecutionPayload<ExtractDocumentTextParams>,
): Promise<TextExtractionResult> {
    // Conversion tools are bounded by the activity deadline, measured from here rather than from their first run.
    initializeActivityCommandDeadline();
    const context = await setupActivity(payload);
    const { client, inputType, params } = context;
    const { output_storage_path } = params;

    if (inputType === 'files') {
        // File mode: extract from file source
        if (!output_storage_path) {
            throw new Error('output_storage_path is required when extracting text from file sources');
        }
        return extractFromFileSource(client, context.file, output_storage_path);
    } else {
        // Object mode: fetch from object store
        return extractFromObject(client, context.objectId, context.objectIds || []);
    }
}

async function extractFromObject(
    client: VertesiaClient,
    objectId: string,
    objectIds: string[],
): Promise<TextExtractionResult> {
    // Fetch the exact revision by id rather than `find({_id, revision.head:true})`.
    // `find` filters to HEAD revisions, so if a newer revision is created while this
    // intake is in flight (e.g. an update with `createRevision: true`), the original
    // revision this workflow was queued for becomes non-head and `find` returns empty —
    // failing intake with a spurious "not found" even though the revision still exists.
    // A direct GET by id resolves the specific revision regardless of head.
    let doc: ContentObject;
    try {
        doc = (await client.objects.retrieve(objectId, '+text')) as ContentObject;
    } catch (err: unknown) {
        const status =
            err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
        if (status === 404) {
            log.error(`Document ${objectId} not found`);
            throw new DocumentNotFoundError(`Document ${objectId} not found`, objectIds);
        }
        throw err;
    }
    if (!doc) {
        log.error(`Document ${objectId} not found`);
        throw new DocumentNotFoundError(`Document ${objectId} not found`, objectIds);
    }

    log.debug(`Extracting text for object ${doc.id}`);

    if (!doc.content?.type || !doc.content?.source) {
        if (doc.text) {
            return createResponse(doc, doc.text, TextExtractionStatus.skipped, 'Text present and no source or type');
        } else {
            return createResponse(doc, '', TextExtractionStatus.error, 'No source or type found');
        }
    }

    //skip if text already extracted and proper etag
    if (doc.text && doc.text.length > 0 && doc.text_etag === doc.content.etag) {
        return createResponse(doc, doc.text, TextExtractionStatus.skipped, 'Text already extracted');
    }

    // Do NOT catch download failures here. Returning a result (rather than throwing) tells
    // Temporal the activity succeeded, so it is never retried: intake carries on and marks the
    // object `completed` with no text at all — a permanently text-less document that looks
    // healthy. A single transient 502 from the signed-URL path was enough to produce one.
    // fetchBlobAsStream already classifies the failure for us: not-found/forbidden become a
    // non-retryable DocumentNotFoundError, and everything else a plain Error the activity's
    // retry policy will retry. Let that classification through.
    const { text: extractedText, skipped } = await extractTextFromSource(client, doc.content.source, doc.content.type);
    if (skipped) {
        return createResponse(doc, doc.text ?? '', TextExtractionStatus.skipped, skipped);
    }
    if (!extractedText) {
        return createResponse(
            doc,
            doc.text ?? '',
            TextExtractionStatus.skipped,
            `Unsupported mime type: ${doc.content.type}`,
        );
    }

    const limitedText = truncateExtractedText(extractedText);
    const txt = limitedText.text;
    if (limitedText.truncated) {
        log.warn(`Extracted text for object ${doc.id} exceeded ${MAX_EXTRACTED_TEXT_BYTES} bytes and was truncated`);
    }

    const tokensData = countTokens(txt);
    const etag = doc.content.etag ?? md5(txt);

    // Persist the extracted text through the dedicated text endpoint which stores it as a text
    // artifact (dual-writing the inline text during the rollout window). Passing the content etag
    // records it as `text_etag` so the skip-if-already-extracted check above keeps working.
    await client.objects.setObjectText(doc.id, { text: txt, etag });

    // Token counts are not part of the text artifact contract — keep updating them on the object.
    await client.objects.update(doc.id, {
        tokens: {
            ...tokensData,
            etag: etag,
        },
    });

    return createResponse(doc, txt, TextExtractionStatus.success);
}

async function extractFromFileSource(
    client: VertesiaClient,
    input_file: WorkflowInputFile,
    output_storage_path: string,
): Promise<TextExtractionResult> {
    log.info(`Extracting text from ${input_file}`);

    // Same reasoning as extractFromObject: swallowing the download failure here is worse still,
    // because createFileSourceResult reports `status: success` — a failed download was
    // indistinguishable from a document that legitimately has no text. Let the error propagate so
    // the retry policy sees it.
    const { text: extractedText, skipped } = await extractTextFromSource(client, input_file.url, input_file.mimetype);
    if (skipped) {
        return {
            ...createFileSourceResult(input_file.url, output_storage_path, null),
            status: TextExtractionStatus.skipped,
            message: skipped,
        };
    }
    const limitedText = extractedText ? truncateExtractedText(extractedText) : undefined;
    const txt = limitedText?.text ?? null;
    if (limitedText?.truncated) {
        log.warn(`Extracted text for ${input_file.url} exceeded ${MAX_EXTRACTED_TEXT_BYTES} bytes and was truncated`);
    }

    // Upload extracted text to storage
    if (txt && output_storage_path) {
        await uploadTextPreviewToStorage(client, txt, output_storage_path, 'Document');
    }

    return createFileSourceResult(input_file.url, output_storage_path, txt);
}

const MiB = 1024 * 1024;

/**
 * Largest source handed to a converter. The source is held in memory, so a larger one is skipped rather than allowed
 * to exhaust the worker's memory, which would take down every activity on it and then, on retry, the next worker.
 */
const CONVERTER_MAX_SOURCE_BYTES = 1024 * MiB;

/** A source of any other type is sniffed for text only up to this size. */
const SNIFF_MAX_BYTES = 500 * 1024;

/** Types converted to text by an external tool, which reads a copy of the source written to disk. */
const CONVERTERS: Record<string, (source: Buffer) => Promise<string>> = {
    'application/pdf': (source) => mutoolPdfToText(source),
    //docx
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (source) =>
        markdownWithMarkitdown(source, 'docx'),
    //pptx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': (source) =>
        markdownWithMarkitdown(source, 'pptx'),
    'text/html': (source) => markdownWithPandoc(source, 'html'),
    //opendocument
    'application/vnd.oasis.opendocument.text': (source) => markdownWithPandoc(source, 'odt'),
    'application/rtf': (source) => markdownWithPandoc(source, 'rtf'),
};

/** Types whose source is the text itself. */
const TEXT_TYPES = new Set([
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/typescript',
    'application/javascript',
    'application/json',
]);

interface SourceText {
    /** The extracted text, or null when the type holds no text this activity can read. */
    text: string | null;
    /** Why the source was not read, when it was too large to. */
    skipped?: string;
}

/**
 * Extract the text of a source, reading no more of it than its type needs. The type decides before anything is
 * downloaded, so a source of any size costs at most:
 * - text types: one byte over {@link MAX_EXTRACTED_TEXT_BYTES}, which is enough for the text to be truncated as it
 *   would be after a full read;
 * - converter types: {@link CONVERTER_MAX_SOURCE_BYTES}, beyond which the source is skipped;
 * - any other type: one byte over {@link SNIFF_MAX_BYTES}, the most it is ever sniffed for text.
 */
async function extractTextFromSource(client: VertesiaClient, source: string, mimeType: string): Promise<SourceText> {
    const convert = CONVERTERS[mimeType];
    if (convert) {
        const head = await fetchBlobHead(client, source, CONVERTER_MAX_SOURCE_BYTES);
        if (head.truncated) {
            log.warn('Skipping text extraction of a source over the converter size limit', {
                source,
                mime_type: mimeType,
                max_bytes: CONVERTER_MAX_SOURCE_BYTES,
            });
            return {
                text: null,
                skipped: `Source too large for text extraction: over ${CONVERTER_MAX_SOURCE_BYTES / MiB} MiB`,
            };
        }
        return { text: await convert(head.data) };
    }

    if (TEXT_TYPES.has(mimeType)) {
        // A truncated read still decodes the same prefix: the truncation that follows keeps only whole characters
        // that fit within the limit.
        const head = await fetchBlobHead(client, source, MAX_EXTRACTED_TEXT_BYTES + 1);
        return { text: head.data.toString('utf8') };
    }

    const head = await fetchBlobHead(client, source, SNIFF_MAX_BYTES + 1);
    if (!head.truncated && sniffIfText(head.data)) {
        return { text: head.data.toString('utf8') }; //TODO: add charset detection
    }
    return { text: null };
}

function createResponse(
    doc: ContentObject,
    text: string,
    status: TextExtractionStatus,
    message?: string,
): TextExtractionResult {
    return {
        status,
        message,
        tokens: getCompleteTokens(doc),
        len: text.length,
        objectId: doc.id,
        hasText: !!text,
    };
}

function getCompleteTokens(doc: ContentObject): TextExtractionResult['tokens'] {
    const tokens = doc.tokens;
    if (tokens?.count === undefined || tokens.encoding === undefined || tokens.etag === undefined) {
        return undefined;
    }
    return {
        count: tokens.count,
        encoding: tokens.encoding,
        etag: tokens.etag,
    };
}

function sniffIfText(buf: Buffer) {
    // If file is too large, don't even try
    if (buf.length > SNIFF_MAX_BYTES) {
        return false;
    }

    // Count binary/control characters
    let binaryCount = 0;
    const sampleSize = Math.min(buf.length, 1000); // Check first 1000 bytes

    for (let i = 0; i < sampleSize; i++) {
        // Count control characters (except common whitespace)
        const byte = buf[i];
        if ((byte < 32 && ![9, 10, 13].includes(byte)) || byte === 0) {
            binaryCount++;
        }
    }

    // If more than 10% binary/control chars, probably not text
    if (binaryCount / sampleSize > 0.1) {
        return false;
    }

    // Additional check for valid UTF-8 encoding
    try {
        const s = buf.toString('utf8');
        return s.length > 0 && !s.includes('\uFFFD'); // Replacement character
    } catch {
        return false;
    }
}
