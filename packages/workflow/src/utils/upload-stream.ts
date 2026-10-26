import { createReadStream, type ReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

/**
 * Open a local file to upload. Release it with {@link closeUploadStream} once the upload has settled.
 *
 * The stream opens its file lazily and nothing reads it until the upload starts sending its body, so a failed open
 * (e.g. EMFILE) would otherwise emit an 'error' nobody listens for: an uncaught exception that takes the worker down.
 * A failed open still fails the upload, which surfaces the error when it reads the stream.
 */
export function createUploadStream(path: string): ReadStream {
    const stream = createReadStream(path);
    stream.on('error', () => undefined);
    return stream;
}

/**
 * Close an upload stream and wait until its descriptor is released. An upload that fails before reading its body never
 * closes the stream, so call this before removing the file: removing it first leaves its space allocated.
 */
export async function closeUploadStream(stream: Readable | undefined): Promise<void> {
    if (!stream) {
        return;
    }
    stream.destroy();
    await finished(stream).catch(() => undefined);
}
