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
    return NodeReadableStream.from(stream) as ReadableStream<T>;
}
