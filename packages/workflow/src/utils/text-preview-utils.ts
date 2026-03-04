import { log } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
import { NodeStreamSource } from "@vertesia/client/node";
import { Readable } from "stream";
import { TextExtractionResult, TextExtractionStatus } from "../result-types.js";

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
 * Saves extracted text to an object in the object store
 */
export async function saveTextToObject(
    vertesia: VertesiaClient,
    objectId: string,
    text: string
): Promise<void> {
    const object = await vertesia.objects.retrieve(objectId);
    await vertesia.objects.update(objectId, {
        text: text,
        text_etag: object.content?.etag,
    });
    log.info(`Saved text to object ${objectId}`);
}
