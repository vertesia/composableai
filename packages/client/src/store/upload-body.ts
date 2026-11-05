import { StreamSource } from '../StreamSource.js';

/**
 * The request body for uploading a source to a signed URL.
 *
 * A `File` is sent as it is. A stream source with a {@link StreamSource.replayableBody} (e.g. a local file) sends
 * that instead, so a retry re-reads it rather than needing a buffered copy; its stream is cancelled, which releases
 * what the stream holds, such as a file descriptor. Any other stream source sends its stream.
 */
export async function getUploadBody(source: StreamSource | File): Promise<Blob | ReadableStream> {
    if (!(source instanceof StreamSource)) return source;
    const body = await source.replayableBody();
    if (!body) return source.stream;
    await source.stream.cancel().catch(() => undefined);
    return body;
}
