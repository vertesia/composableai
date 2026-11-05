import { StreamSource } from '../StreamSource.js';

/** What to send to upload a source: the body, and the declared length of a stream body. */
export interface UploadBody {
    body: Blob | ReadableStream;
    /** Sent as `Content-Length` with a stream body whose length is known; a `Blob` carries its own. */
    contentLength?: number;
}

/**
 * The request body for uploading a source to a signed URL.
 *
 * A `File` is sent as it is. A stream source with a {@link StreamSource.replayableBody} (e.g. a local file) sends
 * that instead, so a retry re-reads it rather than needing a buffered copy; its stream is cancelled, which releases
 * what the stream holds, such as a file descriptor. Any other stream source sends its stream, with its
 * {@link StreamSource.size} when known.
 */
export async function getUploadBody(source: StreamSource | File): Promise<UploadBody> {
    if (!(source instanceof StreamSource)) return { body: source };
    const body = await source.replayableBody();
    if (!body) return { body: source.stream, contentLength: source.size };
    await source.stream.cancel().catch(() => undefined);
    return { body };
}

/** Headers for an upload: the content type, and `Content-Length` when the body declares one. */
export function uploadHeaders(upload: UploadBody, contentType: string | undefined): Record<string, string> | undefined {
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = contentType;
    if (upload.contentLength !== undefined) headers['Content-Length'] = String(upload.contentLength);
    return Object.keys(headers).length > 0 ? headers : undefined;
}

/** An ETag without the quotes HTTP puts around it (RFC 9110), as the upload methods return it. */
export function unquoteEtag(etag: string | undefined): string | undefined {
    return etag?.replace(/^"(.*)"$/, '$1');
}
