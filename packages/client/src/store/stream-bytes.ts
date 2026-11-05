/** Byte handling for upload bodies read from a `ReadableStream`. Internal: not exported from the package. */

const textEncoder = new TextEncoder();

/**
 * Normalize one `ReadableStream` chunk to a byte-backed `BlobPart`.
 *
 * A web stream produced from a Node `Readable.from(<string>)` (e.g. via
 * `Readable.toWeb`, which `NodeStreamSource` uses) yields *string* chunks. Buffering
 * such a stream with `new Response(stream).blob()` throws under undici with
 * "TypeError: Received non-Uint8Array chunk", which breaks every signed-URL upload of
 * a text/JSON body (extracted text previews, agent artifacts, tool storage). Encoding
 * chunks ourselves keeps both string and binary bodies uploadable.
 */
export function chunkToBlobPart(chunk: unknown): BlobPart {
    if (typeof chunk === 'string') {
        return textEncoder.encode(chunk);
    }
    if (chunk instanceof Blob) {
        return chunk;
    }
    if (chunk instanceof ArrayBuffer) {
        return new Uint8Array(chunk);
    }
    // Covers Uint8Array and every other typed-array / DataView view.
    if (ArrayBuffer.isView(chunk)) {
        return new Uint8Array(chunk.buffer as ArrayBuffer, chunk.byteOffset, chunk.byteLength);
    }
    // Fail loud rather than uploading e.g. "[object Object]" from an accidental
    // object-mode stream — silently corrupting the stored content is worse than a clear error.
    throw new TypeError(
        `Unsupported signed-URL upload chunk of type "${typeof chunk}"; ` +
            `body streams must yield string or binary (Uint8Array/ArrayBuffer/DataView/Blob) chunks.`,
    );
}

/** A byte stream of `head`, the parts already read, then what is left in `reader`. */
export function continueStream(
    head: BlobPart[],
    reader: ReadableStreamDefaultReader<unknown>,
): ReadableStream<Uint8Array> {
    const pending = [...head];
    return new ReadableStream<Uint8Array>(
        {
            async pull(controller) {
                const next = pending.shift();
                if (next !== undefined) {
                    controller.enqueue(await partToBytes(next));
                    return;
                }
                const { done, value } = await reader.read();
                if (done) {
                    controller.close();
                } else {
                    controller.enqueue(await partToBytes(chunkToBlobPart(value)));
                }
            },
            async cancel(reason) {
                pending.length = 0;
                await reader.cancel(reason);
            },
        },
        { highWaterMark: 0 },
    );
}

export async function partToBytes(part: BlobPart): Promise<Uint8Array> {
    return part instanceof Blob ? new Uint8Array(await part.arrayBuffer()) : (part as Uint8Array);
}
