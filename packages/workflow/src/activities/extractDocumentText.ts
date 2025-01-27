import { ContentObject, CreateContentObjectPayload, DSLActivityExecutionPayload, DSLActivitySpec } from '@vertesia/common';
import { log } from "@temporalio/activity";
import { mutoolPdfToText } from '../conversion/mutool.js';
import { manyToMarkdown } from '../conversion/pandoc.js';
import { trasformPdfToMarkdown } from '../conversion/pdf.js';
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { NoDocumentFound } from '../errors.js';
import { TextExtractionResult, TextExtractionStatus } from '../result-types.js';
import { fetchBlobAsBuffer, md5 } from '../utils/blobs.js';
import { countTokens } from '../utils/tokens.js';

//@ts-ignore
const JSON: DSLActivitySpec = {
    name: 'extractDocumentText',
}

// doesn't have any own param
export interface ExtractDocumentTextParams { };
export interface ExtractDocumentText extends DSLActivitySpec<ExtractDocumentTextParams> {
    name: 'extractDocumentText';
    projection?: never;
}

export async function extractDocumentText(payload: DSLActivityExecutionPayload<ExtractDocumentTextParams>): Promise<TextExtractionResult> {
    const { client, objectId } = await setupActivity(payload);

    const r = await client.objects.find({
        query: { _id: objectId },
        limit: 1,
        select: "+text"
    })
    const doc = r[0] as ContentObject;
    if (!doc) {
        log.error(`Document ${objectId} not found`);
        throw new NoDocumentFound(`Document ${objectId} not found`, payload.objectIds);
    }

    log.info(`Extracting text for object ${doc.id}`);


    if (!doc.content?.type || !doc.content?.source) {
        if (doc.text) {
            return createResponse(doc, doc.text, TextExtractionStatus.skipped, "Text present and no source or type");
        } else {
            return createResponse(doc, "", TextExtractionStatus.error, "No source or type found");
        }
    }

    //skip if text already extracted and proper etag
    if (doc.text && doc.text.length > 0 && doc.text_etag === doc.content.etag) {
        return createResponse(doc, doc.text, TextExtractionStatus.skipped, "Text already extracted");
    }

    let fileBuffer: Buffer;
    try {
        fileBuffer = await fetchBlobAsBuffer(client, doc.content.source);
    } catch (e: any) {
        log.error(`Error reading file: ${e}`);
        return createResponse(doc, "", TextExtractionStatus.error, e.message);
    }


    let txt: string;

    switch (doc.content.type) {

        case 'application/pdf':
            //if pdf is more than 2MB, use mutool
            if (fileBuffer.length > 2 * 1024 * 1024) {
                txt = await mutoolPdfToText(fileBuffer);
            } else {
                txt = await trasformPdfToMarkdown(fileBuffer);
            }
            break;

        case 'text/plain':
            txt = fileBuffer.toString('utf8')
            break;

        //docx
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            txt = await manyToMarkdown(fileBuffer, 'docx');
            break;

        //html
        case 'text/html':
            txt = await manyToMarkdown(fileBuffer, 'html');
            break;

        //opendocument
        case 'application/vnd.oasis.opendocument.text':
            txt = await manyToMarkdown(fileBuffer, 'odt');
            break;

        //rtf
        case 'application/rtf':
            txt = await manyToMarkdown(fileBuffer, 'rtf');
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
            return createResponse(doc, doc.text ?? '', TextExtractionStatus.skipped, `Unsupported mime type: ${doc.content.type}`);
    }


    const tokensData = countTokens(txt);
    const etag = doc.content.etag ?? md5(txt);

    const updateData: CreateContentObjectPayload = {
        text: txt,
        text_etag: etag,
        tokens: {
            ...tokensData,
            etag: etag,
        }
    }

    await client.objects.update(doc.id, updateData);

    return createResponse(doc, txt, TextExtractionStatus.success);
}

function createResponse(doc: ContentObject, text: string, status: TextExtractionStatus, message?: string): TextExtractionResult {
    return {
        status,
        message,
        tokens: doc.tokens,
        len: text.length,
        objectId: doc.id,
        hasText: !!text,
    }

}


//if file is less than 100KB, check if it looks like text
function sniffIfText(buf: Buffer) {
    if (buf.length < 100 * 1024) {
        const s = buf.toString('utf8');
        if (s.length > 0) {
            return true;
        }
    }
    return false;
}
