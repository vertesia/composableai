import { log } from "@temporalio/activity";
import {
    ContentObject,
    CreateContentObjectPayload,
    DSLActivityExecutionPayload,
    DSLActivitySpec,
} from "@vertesia/common";
import { mutoolPdfToText } from "../conversion/mutool.js";
import { markdownWithPandoc } from "../conversion/pandoc.js";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { NoDocumentFound } from "../errors.js";
import { TextExtractionResult, TextExtractionStatus } from "../result-types.js";
import { fetchBlobAsBuffer, md5 } from "../utils/blobs.js";
import { countTokens } from "../utils/tokens.js";
import { markdownWithMarkitdown } from "../conversion/markitdown.js";

//@ts-ignore
const JSON: DSLActivitySpec = {
    name: "extractDocumentText",
};

// doesn't have any own param
export interface ExtractDocumentTextParams {}
export interface ExtractDocumentText extends DSLActivitySpec<ExtractDocumentTextParams> {
    name: "extractDocumentText";
    projection?: never;
}

export async function extractDocumentText(
    payload: DSLActivityExecutionPayload<ExtractDocumentTextParams>,
): Promise<TextExtractionResult> {
    const { client, objectId } = await setupActivity(payload);

    const r = await client.objects.find({
        query: { _id: objectId },
        limit: 1,
        select: "+text",
    });
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
        case "application/pdf":
            txt = await mutoolPdfToText(fileBuffer);
            break;

        case "text/plain":
            txt = fileBuffer.toString("utf8");
            break;

        //docx
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            txt = await markdownWithMarkitdown(fileBuffer, "docx");
            break;

        //pptx
        case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
            txt = await markdownWithMarkitdown(fileBuffer, "pptx");
            break;

        //html
        case "text/html":
            txt = await markdownWithPandoc(fileBuffer, "html");
            break;

        //opendocument
        case "application/vnd.oasis.opendocument.text":
            txt = await markdownWithPandoc(fileBuffer, "odt");
            break;

        //rtf
        case "application/rtf":
            txt = await markdownWithPandoc(fileBuffer, "rtf");
            break;

        //markdown
        case "text/markdown":
            txt = fileBuffer.toString("utf8");
            break;

        //csv
        case "text/csv":
            txt = fileBuffer.toString("utf8");
            break;

        //typescript
        case "application/typescript":
            txt = fileBuffer.toString("utf8");
            break;

        //javascript
        case "application/javascript":
            txt = fileBuffer.toString("utf8");
            break;

        //json
        case "application/json":
            txt = fileBuffer.toString("utf8");
            break;

        default:
            if (sniffIfText(fileBuffer)) {
                txt = fileBuffer.toString("utf8"); //TODO: add charset detection
                break;
            }
            return createResponse(
                doc,
                doc.text ?? "",
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

function createResponse(
    doc: ContentObject,
    text: string,
    status: TextExtractionStatus,
    message?: string,
): TextExtractionResult {
    return {
        status,
        message,
        tokens: doc.tokens,
        len: text.length,
        objectId: doc.id,
        hasText: !!text,
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
        const s = buf.toString("utf8");
        return s.length > 0 && !s.includes("\uFFFD"); // Replacement character
    } catch (e) {
        return false;
    }
}
