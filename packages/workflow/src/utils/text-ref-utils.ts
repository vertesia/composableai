import { log } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
import { NodeStreamSource } from "@vertesia/client/node";
import { ContentObject, ContentSource } from "@vertesia/common";
import { Readable } from "stream";
import { fetchBlobAsBuffer } from "./blobs.js";

/**
 * Uploads extracted text to GCS and returns a ContentSource reference.
 * The GCS path is deterministic based on objectId, making retries idempotent.
 */
export async function uploadTextAsRef(
    client: VertesiaClient,
    objectId: string,
    text: string,
    etag: string,
    mimeType = 'text/plain'
): Promise<ContentSource> {
    const storagePath = `text/${objectId}`;

    const source = new NodeStreamSource(
        Readable.from(text),
        storagePath,
        mimeType,
        storagePath
    );

    const uploadedPath = await client.files.uploadFile(source);
    log.info(`Uploaded text ref for object ${objectId} to ${uploadedPath}`);

    return {
        source: uploadedPath,
        type: mimeType,
        name: objectId,
        etag,
    };
}

/**
 * Fetches text content from a ContentSource reference stored in GCS.
 */
export async function fetchTextFromRef(
    client: VertesiaClient,
    textRef: ContentSource
): Promise<string> {
    if (!textRef.source) {
        throw new Error('text_ref.source is missing');
    }
    const buffer = await fetchBlobAsBuffer(client, textRef.source);
    return buffer.toString('utf-8');
}

/**
 * Resolves the text content of a document, checking text_ref first (GCS),
 * then falling back to the legacy inline text field.
 */
export async function resolveText(
    client: VertesiaClient,
    doc: ContentObject
): Promise<string | undefined> {
    if (doc.text_ref?.source) {
        return fetchTextFromRef(client, doc.text_ref);
    }
    return doc.text;
}

/**
 * Returns the effective etag for the document's text content.
 */
export function getTextEtag(doc: ContentObject): string | undefined {
    return doc.text_ref?.etag ?? doc.text_etag;
}

/**
 * Returns whether the document has text content (either via text_ref or legacy text field).
 */
export function hasText(doc: ContentObject): boolean {
    return !!(doc.text_ref?.source || doc.text);
}
