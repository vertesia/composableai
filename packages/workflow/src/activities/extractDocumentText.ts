import { log } from '@temporalio/activity';
import type { VertesiaClient } from '@vertesia/client';
import type {
    ContentObject,
    CreateContentObjectPayload,
    DSLActivityExecutionPayload,
    DSLActivitySpec,
    WorkflowInputFile,
} from '@vertesia/common';
import { markdownWithMarkitdown } from '../conversion/markitdown.js';
import { mutoolPdfToText } from '../conversion/mutool.js';
import { markdownWithPandoc } from '../conversion/pandoc.js';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../errors.js';
import { type TextExtractionResult, TextExtractionStatus } from '../result-types.js';
import { fetchBlobAsBuffer, md5 } from '../utils/blobs.js';
import { createFileSourceResult, uploadTextPreviewToStorage } from '../utils/text-preview-utils.js';
import { countTokens } from '../utils/tokens.js';

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

    log.info(`Extracting text for object ${doc.id}`);

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

    let fileBuffer: Buffer;
    try {
        fileBuffer = await fetchBlobAsBuffer(client, doc.content.source);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        log.error(`Error reading file: ${e}`);
        return createResponse(doc, '', TextExtractionStatus.error, message);
    }

    const txt = await extractTextFromBuffer(fileBuffer, doc.content.type);
    if (!txt) {
        return createResponse(
            doc,
            doc.text ?? '',
            TextExtractionStatus.skipped,
            `Unsupported mime type: ${doc.content.type}`,
        );
    }

    const tokensData = countTokens(txt);
    const etag = doc.content.etag ?? md5(txt);

    const updateData: CreateContentObjectPayload = {
        text: txt,
        text_etag: etag,
        tokens: {
            ...tokensData,
            etag: etag,
        },
    };

    await client.objects.update(doc.id, updateData);

    return createResponse(doc, txt, TextExtractionStatus.success);
}

async function extractFromFileSource(
    client: VertesiaClient,
    input_file: WorkflowInputFile,
    output_storage_path: string,
): Promise<TextExtractionResult> {
    log.info(`Extracting text from ${input_file}`);

    let fileBuffer: Buffer;
    try {
        fileBuffer = await fetchBlobAsBuffer(client, input_file.url);
    } catch (e: unknown) {
        log.error(`Error reading file: ${e}`);
        return createFileSourceResult(input_file.url, output_storage_path, null);
    }

    const txt = await extractTextFromBuffer(fileBuffer, input_file.mimetype);

    // Upload extracted text to storage
    if (txt && output_storage_path) {
        await uploadTextPreviewToStorage(client, txt, output_storage_path, 'Document');
    }

    return createFileSourceResult(input_file.url, output_storage_path, txt);
}

async function extractTextFromBuffer(fileBuffer: Buffer, mimeType: string): Promise<string | null> {
    let txt: string;

    switch (mimeType) {
        case 'application/pdf':
            txt = await mutoolPdfToText(fileBuffer);
            break;

        case 'text/plain':
            txt = fileBuffer.toString('utf8');
            break;

        //docx
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            txt = await markdownWithMarkitdown(fileBuffer, 'docx');
            break;

        //pptx
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            txt = await markdownWithMarkitdown(fileBuffer, 'pptx');
            break;

        //html
        case 'text/html':
            txt = await markdownWithPandoc(fileBuffer, 'html');
            break;

        //opendocument
        case 'application/vnd.oasis.opendocument.text':
            txt = await markdownWithPandoc(fileBuffer, 'odt');
            break;

        //rtf
        case 'application/rtf':
            txt = await markdownWithPandoc(fileBuffer, 'rtf');
            break;

        //markdown
        case 'text/markdown':
            txt = fileBuffer.toString('utf8');
            break;

        //csv
        case 'text/csv':
            txt = fileBuffer.toString('utf8');
            break;

        //typescript
        case 'application/typescript':
            txt = fileBuffer.toString('utf8');
            break;

        //javascript
        case 'application/javascript':
            txt = fileBuffer.toString('utf8');
            break;

        //json
        case 'application/json':
            txt = fileBuffer.toString('utf8');
            break;

        default:
            if (sniffIfText(fileBuffer)) {
                txt = fileBuffer.toString('utf8'); //TODO: add charset detection
                break;
            }
            return null;
    }

    return txt;
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
    if (buf.length > 500 * 1024) {
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
