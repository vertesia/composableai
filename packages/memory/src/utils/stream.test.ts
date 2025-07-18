import { describe, test, expect } from "vitest";
import { BufferWritableStream } from "./stream";

describe("BufferWritableStream", () => {
    test("write buffer", () => {
        const stream = new BufferWritableStream();
        stream.write(Buffer.from("hello"));
        stream.write(Buffer.from(" "));
        stream.write(Buffer.from("world"));
        stream.end();
        expect(stream.getText()).toBe("hello world");
    })
})