import type { Readable } from "node:stream";
import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { StreamSource } from "../StreamSource.js";


/**
 * A stream source that wraps a Node.js Readable stream.
 * This class is only works in Node.js environments.
 */
export class NodeStreamSource extends StreamSource {
    constructor(stream: Readable, name: string, type?: string, id?: string) {
        super(readableToWebStream(stream) as ReadableStream, name, type, id);
    }
}

function readableToWebStream<T = string | Buffer>(stream: Readable): ReadableStream<T> {
    if (NodeReadableStream.from) {
        return NodeReadableStream.from(stream) as ReadableStream<T>;
    } else {
        return readableToWebStream_BUN(stream);
    }
}

/**
 * Bun implementation since bun is not yet supporting NodeReadableStream.from
 * @returns
 */
function readableToWebStream_BUN<T = string | Buffer>(stream: Readable): ReadableStream<T> {
    const it = stream[Symbol.asyncIterator]();
    return new ReadableStream<T>({
        async pull(controller) {
            const { value, done } = await it.next();
            if (done) {
                controller.close();
            } else {
                controller.enqueue(value);
            }
        },
        cancel() {
            it.return?.();
        }
    });
}
