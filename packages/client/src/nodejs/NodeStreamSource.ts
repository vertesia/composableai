import * as fs from 'node:fs';
import type { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { StreamSource } from '../StreamSource.js';

/**
 * A stream source that wraps a Node.js Readable stream.
 * This class is only works in Node.js environments.
 * Cancelling the web stream destroys the Node.js stream, releasing its underlying resource (e.g. a file descriptor).
 *
 * When the stream reads a whole local file (`fs.createReadStream(path)`), uploads send a file-backed `Blob`
 * instead of the stream (see {@link replayableBody}): it can be retried without holding the file in memory.
 */
export class NodeStreamSource extends StreamSource {
    private readonly filePath: string | undefined;

    constructor(stream: Readable, name: string, type?: string, id?: string, size?: number) {
        // read before wrapping: the web stream may start reading the Node.js stream
        const filePath = wholeFilePath(stream);
        super(readableToWebStream(stream) as ReadableStream, name, type, id, size);
        this.filePath = filePath;
    }

    /**
     * A `Blob` backed by the file the stream reads, from Node's `fs.openAsBlob`. Reading it reads the file from
     * disk on demand, so each upload attempt streams the file again instead of buffering it.
     */
    override async replayableBody(): Promise<Blob | undefined> {
        if (!this.filePath || typeof fs.openAsBlob !== 'function') return undefined;
        return (await fs.openAsBlob(this.filePath, { type: this.type })) as Blob;
    }
}

/**
 * The path of the file a stream reads, when it reads all of it from the start: an `fs.ReadStream` opened by
 * path with no range or encoding that nothing has read yet. Any other stream (a range, a descriptor, one that
 * decodes the file to text, a stream already consumed, or one that is not a file) has no path, and is uploaded as
 * a stream.
 */
function wholeFilePath(stream: Readable): string | undefined {
    if (!(stream instanceof fs.ReadStream)) return undefined;
    const { path, start, end } = stream as fs.ReadStream & { start?: number; end?: number };
    if (typeof path !== 'string') return undefined;
    if ((start ?? 0) !== 0 || end !== Infinity) return undefined;
    // an encoding uploads the decoded text (e.g. base64), not the file's bytes
    if (stream.readableEncoding) return undefined;
    if (stream.bytesRead > 0 || stream.readableDidRead) return undefined;
    return path;
}

/**
 * Not ReadableStream.from: it cancels by calling return() on the Node.js async iterator, which is a no-op
 * when nothing was read yet, so the Node.js stream would stay open. Also covers Bun, which lacks ReadableStream.from.
 */
function readableToWebStream<T = string | Buffer>(stream: Readable): ReadableStream<T> {
    // Nothing listens until the first read, so an error before it (e.g. a failed lazy file open) would otherwise
    // crash the process. The iterator still reports the error on the next read.
    stream.on('error', () => undefined);
    const it = stream[Symbol.asyncIterator]();
    return new ReadableStream<T>(
        {
            async pull(controller) {
                const { value, done } = await it.next();
                if (done) {
                    controller.close();
                } else {
                    controller.enqueue(value);
                }
            },
            async cancel() {
                // no error argument: it would emit 'error', which the caller may not listen for
                stream.destroy();
                // resolve once the underlying resource is released, so callers can remove the file afterwards;
                // bounded because some streams never report their close
                await finished(stream, { signal: AbortSignal.timeout(5_000) }).catch(() => undefined);
            },
        },
        // read on demand, like ReadableStream.from
        { highWaterMark: 0 },
    );
}
