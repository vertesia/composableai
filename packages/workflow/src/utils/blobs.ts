import { VertesiaClient } from "@vertesia/client";
import crypto from "crypto";
import { createWriteStream } from "fs";
import tmp from "tmp";
import { NoDocumentFound } from "../errors.js";

tmp.setGracefulCleanup();

export async function fetchBlobAsStream(client: VertesiaClient, blobUri: string): Promise<ReadableStream<Uint8Array>> {
    try {
        return await client.files.downloadFile(blobUri);
    } catch (err: any) {
        throw new NoDocumentFound(`Failed to download blob ${blobUri}: ${err.message}`, []);
    }
}
export async function fetchBlobAsBuffer(client: VertesiaClient, blobUri: string): Promise<Buffer> {
    let stream = await fetchBlobAsStream(client, blobUri);
    const buffers: Uint8Array[] = [];
    for await (const data of stream) {
        buffers.push(data);
    }
    return Buffer.concat(buffers);
}

export async function fetchBlobAsBase64(client: VertesiaClient, blobUri: string): Promise<string> {
    const buffer = await fetchBlobAsBuffer(client, blobUri);
    return buffer.toString('base64');
}

export async function saveBlobToFile(client: VertesiaClient, blobUri: string, toFile: string): Promise<void> {
    let stream = await fetchBlobAsStream(client, blobUri);
    const out = createWriteStream(toFile);
    await writeChunksToStream(stream, out);
}

export async function saveBlobToTempFile(client: VertesiaClient, blobUri: string, fileExt?: string): Promise<string> {
    const tmpFile = tmp.fileSync({
        prefix: "vertesia-activity-",
        postfix: "." + fileExt,
        discardDescriptor: true
    });
    await saveBlobToFile(client, blobUri, tmpFile.name);
    return tmpFile.name;
}

async function writeChunksToStream(chunks: AsyncIterable<Uint8Array>, out: NodeJS.WritableStream) {
    for await (const chunk of chunks) {
        if (!out.write(chunk)) {
            // If the internal buffer is full, wait until it's drained
            await new Promise(resolve => out.once('drain', resolve));
        }
    }
    out.end(); // Close the stream when done
}

export function md5(contents: string) {
    return crypto.createHash('md5').update(contents).digest("hex");
}
