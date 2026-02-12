import { log } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
import { NodeStreamSource } from "@vertesia/client/node";
import { Readable } from "stream";
import { TextExtractionResult, TextExtractionStatus } from "../result-types.js";
import { uploadTextAsRef } from "./text-ref-utils.js";

/**
 * Uploads extracted text preview to cloud storage
 */
export async function uploadTextPreviewToStorage(
    vertesia: VertesiaClient,
    text: string,
    storagePath: string,
    fileType: string
): Promise<string> {

    const source = new NodeStreamSource(
        Readable.from(text),
        storagePath,
        'text/markdown',
        storagePath
    );

    const uploadedPath = await vertesia.files.uploadFile(source);
    log.info(`Uploaded ${fileType} preview text to ${uploadedPath}`);

    return uploadedPath;
}

/**
 * Creates the TextExtractionResult for file_source mode
 */
export function createFileSourceResult(
    sourceUrl: string,
    storagePath: string,
    text: string | null
): TextExtractionResult {
    return {
        hasText: !!text,
        file: {
            source_url: sourceUrl,
            result_url: text && storagePath ? storagePath : undefined,
        },
        status: TextExtractionStatus.success,
    };
}

/**
 * Saves extracted text to GCS and updates the object with a text_ref.
 */
export async function saveTextToObject(
    vertesia: VertesiaClient,
    objectId: string,
    text: string
): Promise<void> {
    const object = await vertesia.objects.retrieve(objectId);
    const etag = object.content?.etag ?? '';
    const textRef = await uploadTextAsRef(vertesia, objectId, text, etag);
    await vertesia.objects.update(objectId, { text_ref: textRef });
    log.info(`Saved text ref to object ${objectId}`);
}
