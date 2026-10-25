import type { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { StreamSource } from '../StreamSource.js';

/**
 * A stream source that wraps a Node.js Readable stream.
 * This class is only works in Node.js environments.
 * Cancelling the web stream destroys the Node.js stream, releasing its underlying resource (e.g. a file descriptor).
 */
export class NodeStreamSource extends StreamSource {
    constructor(stream: Readable, name: string, type?: string, id?: string) {
        super(readableToWebStream(stream) as ReadableStream, name, type, id);
    }
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
