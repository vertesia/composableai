import { Writable } from "stream";

export class BufferWritableStream extends Writable {
    chunks: Buffer[] = []
    buffer: Buffer | undefined;

    // _write method is required to handle the incoming data
    _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        this.chunks.push(chunk); // Collect the chunk into the array
        callback(); // Indicate that the write is complete
    }

    // Optional _final method is called when the stream is ending
    _final(callback: (error?: Error | null) => void) {
        this.buffer = Buffer.concat(this.chunks); // Concatenate the collected chunks into a buffer
        callback(); // Indicate the stream is finished
    }

    // Method to get the final buffer when the stream is closed
    getBuffer() {
        return this.buffer;
    }

    getText(encoding: BufferEncoding = "utf-8") {
        return this.buffer?.toString(encoding);
    }
}